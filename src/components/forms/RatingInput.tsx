import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface RatingInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

const MARKS = [0, 2, 4, 6, 8, 10].map((mark) => ({ value: mark, label: String(mark) }));

/**
 * 0–10 rating in 0.5 increments (PRD section 5; Database Schema &
 * Data Model, section 7). Starts empty per UI & UX Specification,
 * section 6 ("Smart Defaults: Rating starts empty") — the slider
 * itself can't represent "no value", so an explicit Clear action is
 * provided alongside it.
 */
export function RatingInput({ value, onChange }: RatingInputProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Rating
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {value === undefined ? 'Not rated' : value.toFixed(1)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 1, pr: 0.5 }}>
        <Slider
          value={value ?? 0}
          onChange={(_event, newValue) => onChange(newValue as number)}
          min={0}
          max={10}
          step={0.5}
          marks={MARKS}
          aria-label="Rating"
          valueLabelDisplay="auto"
          sx={{ flexGrow: 1 }}
        />
        <Button size="small" onClick={() => onChange(undefined)} disabled={value === undefined}>
          Clear
        </Button>
      </Box>
    </Box>
  );
}
