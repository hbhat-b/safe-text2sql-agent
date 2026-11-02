import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Maps the agent's markdown onto shadcn/Tailwind styles so answers match the rest of the UI. */
const components: Components = {
  p: (props) => <p className="leading-7 not-first:mt-3" {...props} />,
  h1: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...props} />,
  h2: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...props} />,
  h3: (props) => <h4 className="mt-4 mb-2 font-semibold first:mt-0" {...props} />,
  ul: (props) => <ul className="my-3 ml-5 list-disc space-y-1" {...props} />,
  ol: (props) => <ol className="my-3 ml-5 list-decimal space-y-1" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => <a className="font-medium underline underline-offset-4" target="_blank" rel="noreferrer" {...props} />,
  code: (props) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />,
  pre: (props) => <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 [&_code]:bg-transparent [&_code]:p-0" {...props} />,
  table: ({ children }) => (
    <div className="my-3 w-fit max-w-full overflow-hidden rounded-lg border">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader className="bg-muted/50">{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead className="px-3">{children}</TableHead>,
  td: ({ children }) => <TableCell className="px-3">{children}</TableCell>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
