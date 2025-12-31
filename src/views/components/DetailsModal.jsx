import { useEffect, useMemo, useRef } from "react";
import { X, User, Mail, Phone, MapPin, Calendar, Shield, Key, Clock, Hash } from "lucide-react";

/**
 * Enhanced DetailsModal with beautiful aesthetics and animations
 */
export default function DetailsModal({
  open,
  title = "Details",
  fields = [],
  record = null,
  onClose,
}) {
  const containerRef = useRef(null);

  // Prepare safe values map
  const values = useMemo(() => {
    const out = {};
    fields.forEach((f) => {
      out[f.name] = record?.[f.name];
    });
    return out;
  }, [fields, record]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && open && onClose?.();
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener("keydown", onKey);
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  if (!record) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200"
        aria-modal="true"
        role="dialog"
      >
        <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
          <div className="rounded-3xl bg-white shadow-2xl border border-gray-100 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Record Selected</h3>
            <p className="text-gray-600 mb-6">Please select a record to view details.</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleBackdropClick = (e) => {
    if (e.target === containerRef.current) onClose?.();
  };

  // Icon mapping for different field types
  const getFieldIcon = (fieldName, fieldType) => {
    const iconMap = {
      email: Mail,
      phone: Phone,
      address: MapPin,
      created_at: Clock,
      updated_at: Clock,
      username: User,
      password_str: Key,
      role: Shield,
      id: Hash,
      first_name: User,
      last_name: User,
    };

    const IconComponent = iconMap[fieldName] || iconMap[fieldType];
    return IconComponent ? <IconComponent className="w-4 h-4 text-gray-400" /> : null;
  };

  const renderValue = (f) => {
    const raw = values[f.name];
    const icon = getFieldIcon(f.name, f.type);

    // Custom formatter wins
    if (typeof f.formatter === "function") {
      return (
        <div className="relative">
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <div className="flex-1 text-sm text-gray-800 min-h-[20px]">
              {f.formatter(raw, record)}
            </div>
          </div>
        </div>
      );
    }

    switch (f.type) {
      case "textarea":
        return (
          <div className="relative">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
              {icon}
              <div className="flex-1">
                <div className="text-sm text-gray-800 whitespace-pre-wrap min-h-[60px] max-h-32 overflow-y-auto">
                  {raw || "Not provided"}
                </div>
              </div>
            </div>
          </div>
        );

      case "select": {
        const label =
          (f.options || []).find((o) => String(o.value) === String(raw))?.label ||
          raw || "Not specified";
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <span className="text-sm text-gray-800 font-medium">{label}</span>
          </div>
        );
      }

      case "checkbox":
      case "switch":
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${raw ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  raw 
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}
              >
                {raw ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        );

      case "badge":
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              {String(raw ?? "—")}
            </span>
          </div>
        );

      case "datetime": {
        const d = raw ? new Date(raw) : new Date();
        const isValid = !isNaN(d.getTime());
        const dateStr = isValid ? d.toLocaleDateString() : "Invalid date";
        const timeStr = isValid ? d.toLocaleTimeString() : "";
        
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{dateStr}</span>
              {timeStr && <span className="text-xs text-gray-500">{timeStr}</span>}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {icon}
            <span className="text-sm text-gray-800 font-medium flex-1 truncate">
              {raw || "Not provided"}
            </span>
          </div>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-4xl max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">{title}</h3>
                <p className="text-indigo-100 text-sm">
                  {record?.first_name && record?.last_name 
                    ? `${record.first_name} ${record.last_name}` 
                    : record?.username || record?.email || "User Details"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-10 -translate-x-10"></div>
          </div>

          {/* Body with scrollable content */}
          <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {fields.map((f, index) => (
                <div 
                  key={f.name} 
                  className="group"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animation: 'slideInUp 0.4s ease-out forwards'
                  }}
                >
                  <label className="block text-sm font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors duration-200">
                    {f.label}
                  </label>
                  <div className="transform group-hover:scale-[1.02] transition-transform duration-200">
                    {renderValue(f)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 border-t border-gray-100 px-8 py-6 bg-gray-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors duration-200 font-medium"
            >
              Close
            </button>
            <button
              type="button"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 font-medium shadow-lg shadow-emerald-600/25"
            >
              Edit Details
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes zoom-in-95 {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .fade-in {
          animation: fade-in var(--duration, 200ms) ease-out;
        }
        
        .zoom-in-95 {
          animation: zoom-in-95 var(--duration, 200ms) ease-out;
        }
      `}</style>
    </div>
  );
}