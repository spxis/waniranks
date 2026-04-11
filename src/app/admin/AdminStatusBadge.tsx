type AdminStatusBadgeProps = {
  checkingSession: boolean;
  sessionAuthorized: boolean;
  signedIn: boolean;
  emailAllowed: boolean;
};

export default function AdminStatusBadge({
  checkingSession,
  sessionAuthorized,
  signedIn,
  emailAllowed,
}: AdminStatusBadgeProps) {
  let label = "Logged out";
  let className = "border-slate-300 bg-slate-100 text-slate-700";

  if (checkingSession) {
    label = "Checking session";
    className = "border-slate-300 bg-slate-100 text-slate-700";
  } else if (sessionAuthorized) {
    label = "Admin authorized";
    className = "border-emerald-300 bg-emerald-100 text-emerald-800";
  } else if (signedIn && !emailAllowed) {
    label = "Signed in - not allowed";
    className = "border-amber-300 bg-amber-100 text-amber-800";
  } else if (signedIn) {
    label = "Signed in";
    className = "border-blue-300 bg-blue-100 text-blue-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}
