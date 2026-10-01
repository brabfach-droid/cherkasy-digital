import type { FormField } from "../config/types";
export function DynamicFields({
  fields,
  data,
  onChange,
  errors = {},
}: {
  fields: FormField[];
  data: Record<string, any>;
  onChange: (k: string, v: any) => void;
  errors?: Record<string, string>;
}) {
  return (
    <>
      {fields
        .filter((f) => !["file", "image", "pdf"].includes(f.type))
        .map((f) => {
          const id = "field-" + f.key,
            v = data[f.key] ?? "";
          if (f.type === "heading") return <h2 key={f.key}>{f.label}</h2>;
          if (f.type === "information")
            return (
              <div key={f.key} className="alert">
                {f.help_text || f.label}
              </div>
            );
          const props = {
            id,
            value: v,
            required: f.required,
            placeholder: f.placeholder,
            "aria-invalid": !!errors[f.key],
            "aria-describedby": id + "-help",
            onChange: (e: any) => onChange(f.key, e.target.value),
          };
          let control;
          if (f.type === "textarea" || f.type === "address")
            control = <textarea {...props} rows={4} />;
          else if (f.type === "select")
            control = (
              <select {...props}>
                <option value="">Виберіть…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            );
          else if (f.type === "multiselect")
            control = (
              <select
                {...props}
                multiple
                value={Array.isArray(v) ? v : []}
                onChange={(e) =>
                  onChange(
                    f.key,
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
              >
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            );
          else if (f.type === "radio")
            control = (
              <fieldset id={id}>
                {f.options.map((o) => (
                  <label className="check" key={o}>
                    <input
                      type="radio"
                      name={f.key}
                      required={f.required}
                      checked={v === o}
                      onChange={() => onChange(f.key, o)}
                    />
                    {o}
                  </label>
                ))}
              </fieldset>
            );
          else if (["checkbox", "confirmation"].includes(f.type))
            control = (
              <input
                id={id}
                type="checkbox"
                checked={v === true}
                required={f.required}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
            );
          else
            control = (
              <input
                {...props}
                type={f.type === "phone" ? "tel" : f.type}
                min={f.validation.min}
                max={f.validation.max}
                minLength={f.validation.minLength}
                maxLength={f.validation.maxLength}
                pattern={f.validation.pattern}
              />
            );
          return (
            <div key={f.key} className="field">
              <label
                htmlFor={id}
                className={
                  ["checkbox", "confirmation"].includes(f.type) ? "check" : ""
                }
              >
                {["checkbox", "confirmation"].includes(f.type) ? control : null}
                {f.label}
                {f.required ? " *" : ""}
              </label>
              {!["checkbox", "confirmation"].includes(f.type) ? control : null}
              <small
                id={id + "-help"}
                className={errors[f.key] ? "field-error" : ""}
              >
                {errors[f.key] || f.help_text}
              </small>
            </div>
          );
        })}
    </>
  );
}
