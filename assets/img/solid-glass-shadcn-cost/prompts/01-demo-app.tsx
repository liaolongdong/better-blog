import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function App() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-8 text-foreground">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-orange-400/40 blur-2xl" />
      <div className="pointer-events-none absolute right-10 top-40 h-80 w-80 rounded-full bg-sky-400/40 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-2xl" />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              stock shadcn/ui · zero component edits
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Solid Glass check</h1>
          </div>
          <span className="text-xs text-muted-foreground">2026-10-21</span>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Agent session #42</CardTitle>
            <CardDescription>
              A stock Card and three stock Button variants, untouched. Only one stylesheet was added.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed">
              This panel sits on top of three coloured blobs. If the material is doing what the
              README says, the text stays readable and the colour only shows at the edges.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button>Run task</Button>
              <Button variant="secondary">Pause</Button>
              <Button variant="outline">View logs</Button>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            3 tools · 1 file changed · context 68%
          </CardFooter>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Tool steps</CardTitle>
              <CardDescription>Read file, patch, typecheck.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-16 rounded-md bg-muted" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Context</CardTitle>
              <CardDescription>68% of the window used.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-16 rounded-md bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
