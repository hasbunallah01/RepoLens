import { Button } from "@/components/Button";
import { CheckCircleIcon } from "@/components/icons";
import { PARITOK_CHECKLIST, PARITOK_NODES } from "@/lib/mock-about-data";

/**
 * "Powered by Paritok" — explains the retrieval engine RepoLens is built
 * around, with a checklist and a circular node diagram (illustration only,
 * no live data behind it).
 */
export function PoweredByParitok() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-brand-teal-50/40 p-6 shadow-sm shadow-slate-100 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Powered by</p>

      <div className="mt-8 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-teal">Paritok</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Paritok is a next-generation retrieval engine that makes AI code
            understanding efficient, explainable, and scalable.
          </p>
          <ul className="mt-5 space-y-2.5">
            {PARITOK_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            href="https://github.com/hasbunallah01/RepoLens"
            variant="secondary"
            size="md"
            className="mt-6"
          >
            Learn more about Paritok
            <span aria-hidden="true">→</span>
          </Button>
        </div>

        <ParitokDiagram />
      </div>
    </div>
  );
}

const NODE_POSITIONS = [
  { top: "10%", left: "50%" },
  { top: "36%", left: "88%" },
  { top: "82%", left: "74%" },
  { top: "82%", left: "26%" },
  { top: "36%", left: "12%" },
];

function ParitokDiagram() {
  return (
    <div className="relative mx-auto h-72 w-72 max-w-full">
      <div className="absolute inset-6 rounded-full border border-dashed border-brand-teal/25" />
      <div className="absolute inset-0 rounded-full border border-dashed border-brand-teal/15" />

      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-navy text-lg font-bold text-white shadow-lg shadow-brand-navy/30">
        P
      </div>

      {PARITOK_NODES.map((label, i) => {
        const pos = NODE_POSITIONS[i];
        if (!pos) return null;
        return (
          <div
            key={label}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-brand-navy shadow-sm shadow-slate-200 ring-1 ring-slate-100"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
