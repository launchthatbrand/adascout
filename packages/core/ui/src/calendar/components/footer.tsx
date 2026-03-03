import { DarkModeToggle } from "./dark-mode-toggle";
import Link from "next/link";
import { Separator } from "./ui/separator";

export default function Footer() {
  return (
    <div className="space-y-4 px-5 pb-5 text-xs md:text-sm">
      <Separator />
      <div className="flex flex-wrap items-center justify-between">
        <p className="flex-shrink-0">
          {`Built with ❤️ by `}
          <Link href="https://github.com/robskinney" className="underline">
            robskinney
          </Link>
          .
        </p>

        <DarkModeToggle />
      </div>
    </div>
  );
}
