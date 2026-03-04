import Link from "next/link";

export default function TemplateFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/80 px-6 py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Springtime Tallahassee Festival Guide</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-foreground">
            Map
          </Link>
          <a
            href="https://springtimetallahassee.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Official Site
          </a>
          <a
            href="https://www.facebook.com/springtimetallahasseefestival/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Facebook
          </a>
        </div>
      </div>
    </footer>
  );
}
