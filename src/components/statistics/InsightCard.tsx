import Alert from '@mui/material/Alert';

interface InsightCardProps {
  text: string;
}

/** A single dynamically-generated insight sentence (UI & UX
 * Specification, section 8: "Insights"). */
export function InsightCard({ text }: InsightCardProps) {
  return (
    <Alert severity="info" variant="outlined" icon={false}>
      {text}
    </Alert>
  );
}
