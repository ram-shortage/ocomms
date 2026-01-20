"use client";

interface PasswordRequirementsProps {
  password: string;
}

const requirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) {
    return null;
  }

  return (
    <ul className="space-y-0.5">
      {requirements.map(({ label, test }) => {
        const met = test(password);
        return (
          <li
            key={label}
            className={`text-xs flex items-center gap-1.5 ${
              met ? "text-green-600" : "text-muted-foreground"
            }`}
          >
            <span>{met ? "\u2713" : "\u25CB"}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
