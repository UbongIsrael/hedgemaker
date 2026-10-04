import { useId } from "react";

export type SegmentedOption<Value extends string = string> = { value: Value; label: string; disabled?: boolean };
export type SegmentedControlProps<Value extends string = string> = {
  value: Value;
  onChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
  name?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function SegmentedControl<Value extends string = string>({
  value, onChange, options, name, label, className = "", disabled = false,
}: SegmentedControlProps<Value>) {
  const id = useId();
  const groupName = name ?? id;
  return (
    <fieldset className={["hm-segmented", className].filter(Boolean).join(" ")} disabled={disabled}>
      {label && <legend className="hm-segmented__label">{label}</legend>}
      <div className="hm-segmented__options" role="radiogroup" aria-label={label || undefined}>
        {options.map((option, index) => {
          const optionId = `${id}-${index}`;
          return (
            <label className="hm-segmented__option" htmlFor={optionId} key={option.value}>
              <input
                className="hm-segmented__radio"
                id={optionId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={option.value === value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
              />
              <span className="hm-segmented__text">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
