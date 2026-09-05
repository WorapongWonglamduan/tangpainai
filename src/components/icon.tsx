type IconProps = {
  name: string;
  className?: string;
};

export function Icon({ name, className }: IconProps) {
  return <span className={`material-symbols-outlined select-none leading-none ${className ?? ""}`}>{name}</span>;
}
