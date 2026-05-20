import { useState, useRef, useEffect } from "react";

/**
 * EditableText — Click any text to edit it inline
 * Simple: click to edit, Enter to save, Escape to cancel
 */
export default function EditableText({
  textKey,
  defaultText,
  onSave,
  style = {},
  inputStyle = {},
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
      return saved[textKey] || defaultText;
    } catch { return defaultText; }
  });
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
      setValue(saved[textKey] || defaultText);
    } catch { setValue(defaultText); }
  }, [textKey, defaultText]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (value.trim() && value !== defaultText) {
      try {
        const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
        saved[textKey] = value.trim();
        localStorage.setItem("editable_texts", JSON.stringify(saved));
      } catch {}
      onSave?.(textKey, value.trim());
    } else if (!value.trim()) {
      setValue(defaultText);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") {
      setValue(defaultText);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          border: "none",
          borderBottom: "2px solid #8B5CF6",
          background: "transparent",
          outline: "none",
          padding: "0 0 2px 0",
          minWidth: 80,
          ...style,
          ...inputStyle,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      style={{
        cursor: "pointer",
        borderBottom: "1px dashed transparent",
        transition: "border-color 0.2s",
        ...style,
      }}
      title="Cliquez pour modifier"
      onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = "#94A3B8"}
      onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = "transparent"}
    >
      {value}
    </span>
  );
}

/**
 * Reset all editable texts
 */
export function resetEditableTexts() {
  localStorage.removeItem("editable_texts");
}
