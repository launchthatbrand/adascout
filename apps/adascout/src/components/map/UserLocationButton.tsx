"use client";

interface UserLocationButtonProps {
  onLocate: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const UserLocationButton = ({
  onLocate,
  disabled,
  loading,
}: UserLocationButtonProps) => {
  return (
    <button
      type="button"
      onClick={onLocate}
      disabled={disabled || loading}
      className="inline-flex items-center rounded-md border border-white/40 bg-white/45 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur-xl transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Locating..." : "Use my location"}
    </button>
  );
};
