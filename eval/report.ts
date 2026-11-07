export function printMatrix(
  title: string,
  rows: { expected: string; actual: string }[]
): void {
  const labels = [...new Set(rows.flatMap((r) => [r.expected, r.actual]))]
    .filter((l) => l !== '(any)')
    .sort();
  if (labels.length === 0) return;

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(`${r.expected}|${r.actual}`, (counts.get(`${r.expected}|${r.actual}`) ?? 0) + 1);

  const w = Math.max(22, ...labels.map((l) => l.length + 2));
  const cell = (s: string) => s.padEnd(w).slice(0, w);

  console.log(`\n  ${title}: rows = expected, columns = actual\n`);
  console.log('  ' + cell('') + labels.map((l) => l.slice(0, 10).padStart(11)).join(''));
  for (const exp of labels) {
    const line = labels
      .map((act) => String(counts.get(`${exp}|${act}`) ?? '·').padStart(11))
      .join('');
    console.log('  ' + cell(exp) + line);
  }
}
