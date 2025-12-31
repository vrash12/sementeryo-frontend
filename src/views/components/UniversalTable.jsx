import React from "react";

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "Toggle"}
      onClick={() => onChange?.(!checked)}
      className={[
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full",
        "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        checked ? "bg-emerald-500" : "bg-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow",
          "ring-1 ring-black/5 transition duration-200",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function UniversalTable({
  columns = [],
  data = [],
  rowKey = "id",
  onRowClick,
  className = "",
  emptyText = "No records found.",
}) {
  const gridTemplate = columns.map((c) => c.width || "1fr").join(" ");
  const gridStyle = { gridTemplateColumns: gridTemplate };

  return (
    <div className={["w-full", className].join(" ")}>
      <div className="rounded-xl overflow-hidden bg-white ring-1 ring-slate-200">
        {/* Header — subtle, roomy */}
        <div
          className="grid items-center px-6 py-3 bg-slate-50 text-slate-600 text-sm font-medium border-b border-slate-200"
          style={gridStyle}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className={[
                "truncate",
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left",
              ].join(" ")}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Body — lined rows, generous spacing, hover tint */}
        <div className="divide-y divide-slate-100">
          {(!data || data.length === 0) ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {emptyText}
            </div>
          ) : (
            data.map((row, idx) => (
              <div
                key={row[rowKey] ?? idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "grid items-center px-6 py-5 text-sm text-slate-800",
                  "hover:bg-slate-50 transition",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
                style={gridStyle}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={[
                      "min-w-0",
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left",
                    ].join(" ")}
                  >
                    {col.render ? (
                      col.render(row)
                    ) : (
                      <span className="truncate">{String(row[col.key] ?? "")}</span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
