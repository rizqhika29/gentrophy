import { Link, NavLink, useLocation } from "react-router-dom";
import { WalletButton } from "@/components/WalletButton";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/features", label: "Features" },
  { to: "/app", label: "Launch App" },
];

export function Header() {
  const { pathname } = useLocation();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="text-primary">◆</span> GenTrophy
        </Link>
        <nav className="flex items-center gap-1 text-xs sm:gap-2 sm:text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-1.5 transition-colors sm:px-3",
                  isActive || (l.to === "/" && pathname === "/")
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
