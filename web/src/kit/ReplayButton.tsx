/** The replay button every animated view has (docs/style-guide.md). */
export function ReplayButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="vbtns">
      <button type="button" className="vbtn go" onClick={onClick}>{label}</button>
    </div>
  );
}
