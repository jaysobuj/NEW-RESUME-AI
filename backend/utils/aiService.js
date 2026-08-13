// aiService.js — fixed edition
// Uses native fetch (Node 18+) instead of node-fetch
// Uses the current Gemini Flash model configured by the environment.

const { buildGroundTruth, checkTextAgainstTruth, checkBulletRewrite } = require('./truthCheck');
const { scoreResumeAgainstJob } = require('./atsScoring');

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

function safeParseNames(field) {
  try {
    const arr = typeof field === 'string' ? JSON.parse(field) : field;
    if (!Array.isArray(arr)) return [];
    return arr.map(i => (typeof i === 'string' ? i : i.name || '')).filter(Boolean);
  } catch { return []; }
}

// Local fallbacks
function localImproveSummary(resume, jobDescription) {
  const ats = scoreResumeAgainstJob(resume, jobDescription || '');
  const top = ats.matchedKeywords.slice(0, 3).join(', ');
  const skills = safeParseNames(resume.skills).slice(0, 3).join(', ');
  let s = resume.summary ? resume.summary.trim() : `${resume.full_name || 'Candidate'} is a motivated professional`;
  if (skills) s += ` skilled in ${skills}`;
  s += '.';
  if (top) s += ` Experienced in areas relevant to this role including ${top}.`;
  return s;
}

function localRewriteBullet(bulletText) {
  const t = sanitizeBulletRewrite(bulletText);
  const hasVerb = /^(Achieved|Built|Created|Designed|Developed|Delivered|Managed|Led|Implemented|Improved|Increased|Reduced|Launched|Organized|Analyzed|Automated|Streamlined|Optimized|Resolved|Collaborated|Mentored|Executed|Maintained|Engineered|Deployed|Tested|Documented|Researched|Planned)/i.test(t);
  let r = hasVerb ? t : `Contributed to ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  return r;
}

function sanitizeBulletRewrite(output) {
  let text = String(output || '')
    .replace(/```(?:text|markdown)?/gi, '')
    .replace(/\*\*/g, '')
    .trim();

  text = text.replace(/^(?:rewritten (?:target )?bullet|ai rewrite|rewrite)\s*:\s*/i, '');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const bulletLines = lines.filter(line => /^(?:[•*-]|\d+[.)])\s+/.test(line));
  const chosen = bulletLines.length ? bulletLines[0] : lines[0] || '';
  return chosen
    .replace(/^(?:[•*-]|\d+[.)])\s+/, '')
    .split(/\s+[•]\s+|\s+(?=\d+[.)]\s+)/, 1)[0]
    .trim();
}

function localTailorResume(resume, jobDescription) {
  const ats = scoreResumeAgainstJob(resume, jobDescription);
  return {
    tailoredSummary: localImproveSummary(resume, jobDescription),
    keywordsToAdd: ats.missingKeywords.slice(0, 10),
    reasoning: 'Local rule-based tailoring — no new facts invented, only your existing resume content was used.',
    atsScoreBefore: ats.overallScore,
  };
}

async function callGemini(prompt, maxTokens = 500) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens }
    })
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Gemini ${res.status}: ${t}`); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text.trim();
}

async function improveSummary(resume, jobDescription) {
  const groundTruth = buildGroundTruth(resume);
  if (GEMINI_KEY) {
    try {
      const prompt = `Rewrite this professional summary to be more compelling for the job below. RULES: Do NOT invent any skills, titles, employers, or experience not already in the original. Only rephrase existing true information.\n\nOriginal summary:\n${resume.summary || ''}\n\nJob description:\n${jobDescription || 'N/A'}\n\nRewritten summary (2-4 sentences, plain text only):`;
      const text = await callGemini(prompt);
      const check = checkTextAgainstTruth(text, groundTruth, resume.summary || '');
      return { text: check.cleanedText, source: 'gemini', truthFlags: check.flags };
    } catch(e) { console.warn('Gemini failed:', e.message); }
  }
  const local = localImproveSummary(resume, jobDescription);
  const check = checkTextAgainstTruth(local, groundTruth, resume.summary || '');
  return { text: check.cleanedText, source: 'local_rules', truthFlags: check.flags };
}

async function rewriteBullet(bulletText) {
  const targetBullet = sanitizeBulletRewrite(bulletText);
  if (GEMINI_KEY) {
    try {
      const prompt = `You are an expert resume bullet editor. Rewrite ONLY the single TARGET BULLET below.\n\nRules:\n1. Return exactly ONE bullet point in plain text.\n2. Do not include explanations, headings, lists, or any other resume content.\n3. Preserve the factual meaning.\n4. Do not invent numbers, percentages, awards, skills, technologies, duties, or achievements.\n5. If the target contains no metric, do not add one.\n6. Improve clarity, concision, ATS readability, and action-oriented wording.\n7. Prefer a strong action verb and approximately 15-35 words where practical.\n\nTARGET BULLET:\n${targetBullet}\n\nReturn ONLY the rewritten TARGET BULLET.`;
      // Gemini 3.x spends part of this budget on reasoning. Keep enough room
      // for that work plus the complete rewritten bullet.
      const text = sanitizeBulletRewrite(await callGemini(prompt, 800));
      if (!text) throw new Error('Gemini returned no valid bullet');
      const check = checkBulletRewrite(text, targetBullet);
      return { success: true, rewrittenBullet: text, source: 'gemini', truthFlags: check.flags };
    } catch(e) { console.warn('Gemini failed:', e.message); }
  }
  const local = localRewriteBullet(targetBullet);
  const check = checkBulletRewrite(local, targetBullet);
  return { success: true, rewrittenBullet: local, source: 'local_rules', truthFlags: check.flags };
}

// Flattens resume.experience into a linear list of {expIndex, bulletIndex,
// text, expTitle} — shared by tailorResume() (which may rewrite several
// bullets at once) and chatRefine() (which targets one at a time).
function flattenBullets(resume) {
  let experience = [];
  try { experience = typeof resume.experience === 'string' ? JSON.parse(resume.experience) : (resume.experience || []); } catch { experience = []; }
  const flat = [];
  experience.forEach((exp, expIndex) => {
    (exp.bullets || []).forEach((text, bulletIndex) => {
      if (text && text.trim()) flat.push({ expIndex, bulletIndex, text, expTitle: exp.title || '' });
    });
  });
  return { experience, flat };
}

// tailorResume() rewrites the summary AND proposes rewrites for the
// bullets most relevant to the job (not just the summary) — capped at 8
// so the Gemini response and the UI diff both stay readable. Every
// proposed bullet is truth-checked the same way a chat bullet edit is;
// unsafe ones are dropped rather than reverted silently swallowed, so
// the caller can still see something was flagged.
async function tailorResume(resume, jobDescription) {
  const groundTruth = buildGroundTruth(resume);
  const { flat } = flattenBullets(resume);

  if (GEMINI_KEY) {
    try {
      const bulletList = flat.map((b, i) => `[${i}] (${b.expTitle}): ${b.text}`).join('\n');
      const prompt = `You are a truth-constrained resume tailoring assistant. Rewrite the professional summary AND select up to 8 of the EXISTING bullet points below that are most relevant to this job, sharpening their wording, ATS keyword alignment and action-verb strength. Do NOT invent skills, numbers, employers, technologies or achievements not already present in the bullet you are rewriting. Respond ONLY in this exact JSON format with no other text:\n{"tailoredSummary": "...", "keywordsToAdd": ["..."], "reasoning": "...", "tailoredBullets": [{"index": <bullet index from the list below>, "text": "rewritten bullet"}]}\n\nResume summary: ${resume.summary || ''}\nResume skills: ${safeParseNames(resume.skills).join(', ')}\nJob description: ${jobDescription}\n\nExisting bullets (index: text):\n${bulletList || '(none)'}`;
      // Gemini 3.x uses part of the output budget for reasoning, and this
      // response now also carries up to 8 rewritten bullets — give it room.
      const text = await callGemini(prompt, 3200);
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const check = checkTextAgainstTruth(parsed.tailoredSummary || '', groundTruth, resume.summary || '');

      const truthFlags = [...check.flags];
      const tailoredBullets = [];
      (parsed.tailoredBullets || []).forEach(tb => {
        const src = flat[tb.index];
        if (!src || !tb.text) return;
        const bCheck = checkBulletRewrite(tb.text, src.text);
        if (bCheck.isSafe && bCheck.cleanedText !== src.text) {
          tailoredBullets.push({ expIndex: src.expIndex, bulletIndex: src.bulletIndex, original: src.text, text: bCheck.cleanedText });
        } else if (!bCheck.isSafe) {
          truthFlags.push(...bCheck.flags);
        }
      });

      return {
        tailoredSummary: check.cleanedText, keywordsToAdd: parsed.keywordsToAdd || [], reasoning: parsed.reasoning || '',
        tailoredBullets, source: 'gemini', truthFlags,
      };
    } catch(e) { console.warn('Gemini tailor failed:', e.message); }
  }

  const local = localTailorResume(resume, jobDescription);
  const check = checkTextAgainstTruth(local.tailoredSummary, groundTruth, resume.summary || '');
  const tailoredBullets = flat
    // Skip short fragments (common from messy PDF text extraction) —
    // the "add an action verb" rewrite only reads sensibly on a
    // reasonably complete sentence.
    .filter(b => b.text.length >= 30 && localRewriteBullet(b.text) !== b.text)
    .slice(0, 6)
    .map(b => ({ expIndex: b.expIndex, bulletIndex: b.bulletIndex, original: b.text, text: localRewriteBullet(b.text) }));
  return { ...local, tailoredSummary: check.cleanedText, tailoredBullets, source: 'local_rules', truthFlags: check.flags };
}

// ==========================================================
// chatRefine — the compact chat used inside AI Tailoring.
// Scope is deliberately narrow: the chat can only propose a revised
// SUMMARY or a revised single BULLET (picked by keyword overlap with
// the user's message, or the first bullet if none match) — never
// invents new sections. Every proposal is truth-checked the same way
// as the rest of the app, and returned as a PROPOSAL for the user to
// Apply/Regenerate/Discard — it never writes to the resume itself.
// ==========================================================
function findTargetBullet(resume, message) {
  const { flat: bullets } = flattenBullets(resume);
  if (!bullets.length) return null;

  const words = (message.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
  let best = null, bestScore = 0;
  bullets.forEach(b => {
    const lower = b.text.toLowerCase();
    const score = words.filter(w => lower.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = b; }
  });
  return best || bullets[0];
}

async function chatRefine({ resume, job, currentSummary, message, history = [] }) {
  const groundTruth = buildGroundTruth(resume);
  const wantsBullet = /bullet|point/i.test(message);
  const targetBullet = wantsBullet ? findTargetBullet(resume, message) : null;

  if (GEMINI_KEY) {
    try {
      const historyText = history.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
      const prompt = `You are a truth-constrained resume tailoring assistant chatting with a candidate inside a resume builder.

RULES:
- Do NOT invent any skills, employers, titles, qualifications, certifications, technologies, metrics or achievements not already present in the candidate's resume facts below.
- Only rephrase, reorder or trim existing true information.
- Respond ONLY in this exact JSON shape, no other text: {"reply": "short conversational reply (1-3 sentences)", "proposedSummary": "revised summary text, or null if the user isn't asking about the summary", "proposedBulletText": "revised bullet text, or null if the user isn't asking about a bullet"}

Candidate resume facts: ${[resume.summary, groundTruth.words.size ? [...groundTruth.words].join(', ') : ''].filter(Boolean).join(' | ')}
Target job: ${job?.title || 'N/A'} at ${job?.company || 'N/A'}
Job description: ${(job?.description || 'N/A').slice(0, 1500)}
Current tailored summary: ${currentSummary || resume.summary || ''}
${targetBullet ? `Bullet currently being discussed: "${targetBullet.text}"` : ''}
Recent conversation:
${historyText || '(none yet)'}

User message: ${message}`;

      // Gemini 3.x spends part of this budget on reasoning before the
      // JSON reply, same as tailorResume() above — too small and the
      // JSON gets cut off mid-string.
      const text = await callGemini(prompt, 1500);
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

      let proposedSummary = null, summaryFlags = [];
      if (parsed.proposedSummary) {
        const check = checkTextAgainstTruth(parsed.proposedSummary, groundTruth, currentSummary || resume.summary || '');
        proposedSummary = check.isSafe ? check.cleanedText : null;
        summaryFlags = check.flags;
      }
      let proposedBullet = null, bulletFlags = [];
      if (parsed.proposedBulletText && targetBullet) {
        const check = checkBulletRewrite(parsed.proposedBulletText, targetBullet.text);
        proposedBullet = check.isSafe ? { ...targetBullet, text: check.cleanedText } : null;
        bulletFlags = check.flags;
      }

      return {
        reply: parsed.reply || 'Here is what I found.',
        proposedSummary, proposedBullet,
        truthFlags: [...summaryFlags, ...bulletFlags],
        source: 'gemini',
      };
    } catch (e) { console.warn('Gemini chat failed:', e.message); }
  }

  // Local fallback — simple, deterministic, always available.
  let reply, proposedSummary = null, proposedBullet = null;
  const base = currentSummary || resume.summary || '';
  if (/shorter|concise|shorten|trim/i.test(message)) {
    const sentences = base.split(/(?<=[.!?])\s+/).filter(Boolean);
    proposedSummary = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(' ');
    reply = 'Here is a shorter version of your summary.';
  } else if (/ats.?friendly|keyword/i.test(message) && job?.description) {
    const scored = scoreResumeAgainstJob(resume, job.description);
    const top = scored.matchedKeywords.slice(0, 3).join(', ');
    proposedSummary = top ? `${base} Strengths relevant to this role include ${top}.` : base;
    reply = 'I emphasised keywords already backed by your resume.';
  } else if (targetBullet) {
    proposedBullet = { ...targetBullet, text: localRewriteBullet(targetBullet.text) };
    reply = `Here's a rewrite of the bullet: "${targetBullet.text.slice(0, 60)}${targetBullet.text.length > 60 ? '…' : ''}"`;
  } else {
    reply = "Local mode (no Gemini key): try \"make it shorter\", \"make it more ATS friendly\", or \"rewrite the bullet about X\".";
  }

  const check = proposedSummary ? checkTextAgainstTruth(proposedSummary, groundTruth, base) : null;
  return {
    reply,
    proposedSummary: check ? (check.isSafe ? check.cleanedText : null) : null,
    proposedBullet,
    truthFlags: check ? check.flags : [],
    source: 'local_rules',
  };
}

module.exports = { improveSummary, rewriteBullet, tailorResume, chatRefine, sanitizeBulletRewrite, localRewriteBullet };
