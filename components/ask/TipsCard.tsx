import { ChatIcon, CodeIcon, LightbulbIcon, TargetIcon } from "@/components/icons";
import { TIPS } from "@/lib/mock-ask-data";

const TIP_ICONS = [TargetIcon, LightbulbIcon, ChatIcon, CodeIcon];

/**
 * "Tips" sidebar card — quick usage hints.
 */
export function TipsCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Tips</h3>
      <ul className="mt-4 space-y-3">
        {TIPS.map((tip, i) => {
          const Icon = TIP_ICONS[i % TIP_ICONS.length] ?? LightbulbIcon;
          return (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-slate-600">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
              <span>{tip}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
