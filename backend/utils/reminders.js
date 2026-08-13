// ==========================================================
// reminders.js
// Pure, offline "smart reminder" logic for the application tracker —
// no cron, no email, no external calls. Reminders are derived fresh
// on every read from the application records themselves, the same way
// ATS scoring is stateless and computed on demand.
//
// This is deliberately "Tier A" automation: the app nudges the user to
// update stale statuses and surfaces upcoming interview dates; it does
// NOT attempt to detect real-world outcomes (that would require inbox
// or ATS access, a separate and much larger feature).
// ==========================================================

const MS_PER_DAY = 86400000;

// How many days of silence before a status is considered "stale" and
// worth nudging about. Named constants so these are easy to tune later.
const STALE_THRESHOLDS = {
  Saved: 3,
  Applied: 7,
};

function daysBetween(msLater, msEarlier) {
  return Math.floor((msLater - msEarlier) / MS_PER_DAY);
}

// Legacy records created before this feature existed won't have
// status_updated_at — fall back to updated_at, then created_at, so old
// data doesn't crash or silently skip reminders forever.
function statusChangedAt(app) {
  const raw = app.status_updated_at || app.updated_at || app.created_at;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
}

function isSnoozed(app, nowMs) {
  if (!app.reminder_snoozed_until) return false;
  const t = new Date(app.reminder_snoozed_until).getTime();
  return !Number.isNaN(t) && t > nowMs;
}

function buildReminders(applications, nowMs = Date.now()) {
  const reminders = [];

  applications.forEach(app => {
    if (isSnoozed(app, nowMs)) return;

    const changedAt = statusChangedAt(app);

    // Stale "Saved" / "Applied" — no movement in a while.
    const staleThreshold = STALE_THRESHOLDS[app.status];
    if (staleThreshold !== undefined && changedAt !== null) {
      const daysIdle = daysBetween(nowMs, changedAt);
      if (daysIdle >= staleThreshold) {
        reminders.push({
          applicationId: app.id,
          type: 'stale',
          severity: app.status === 'Applied' ? 'warning' : 'info',
          message: app.status === 'Applied'
            ? `Still waiting to hear back from ${app.company_name}? It's been ${daysIdle} days.`
            : `You saved ${app.company_name} — ready to apply?`,
          daysIdle,
        });
      }
    }

    // Interview date awareness — upcoming, or passed without an outcome logged.
    if (app.status === 'Interview' && app.interview_date) {
      const interviewMs = new Date(app.interview_date).getTime();
      if (!Number.isNaN(interviewMs)) {
        if (interviewMs >= nowMs) {
          const daysUntil = daysBetween(interviewMs, nowMs);
          reminders.push({
            applicationId: app.id,
            type: 'upcoming_interview',
            severity: 'info',
            message: daysUntil === 0
              ? `Interview at ${app.company_name} today!`
              : `Upcoming interview at ${app.company_name} in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${app.interview_date}).`,
            daysUntil,
          });
        } else {
          const daysSince = daysBetween(nowMs, interviewMs);
          reminders.push({
            applicationId: app.id,
            type: 'followup',
            severity: 'warning',
            message: `Your interview with ${app.company_name} was ${daysSince} day${daysSince === 1 ? '' : 's'} ago — update the outcome?`,
            daysSince,
          });
        }
      }
    }
  });

  return reminders;
}

module.exports = { buildReminders, STALE_THRESHOLDS };
