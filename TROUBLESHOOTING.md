# OpenObs Troubleshooting Log

## Issue
App window opens but displays blank/dark screen.

## Environment
- Tauri 2.0
- React 18
- Vite 6
- macOS

## Fixed Issues
1. **Tauri config error**: Removed invalid `scope` field from `plugins.fs` in `tauri.conf.json`
   - Error was: `unknown field 'scope', expected 'requireLiteralLeadingDot'`

## Debugging Steps

### Test 1: Minimal React - ✅ WORKS
```tsx
function App() {
  return (
    <div style={{ backgroundColor: '#1e1e1e', color: '#dcddde', height: '100vh' }}>
      <h1>OpenObs</h1>
      <p>React is working!</p>
    </div>
  );
}
```
**Result**: Shows "OpenObs - React is working!"

### Test 2: With Zustand Store - ✅ WORKS
```tsx
import { useStore } from './store';
// ... using theme from store
```
**Result**: Shows "Theme: dark"

### Test 3: With Layout Component - ❌ BLANK
```tsx
import { Layout } from './components/Layout';
```
**Result**: Blank screen

### Test 4: With Tailwind Classes Only - ✅ WORKS
```tsx
<div className="flex h-screen bg-background-primary text-text-normal">
```
**Result**: Shows styled content

### Test 5: With Button Component - ✅ WORKS
```tsx
import { Button } from './components/ui/Button';
```
**Result**: Button renders and works

### Test 6: With lucide-react Icons - ❌ BLANK
```tsx
import { FileText } from 'lucide-react';
```
**Result**: Blank screen

### Test 7: With Inline SVG (no lucide) - ❓ TESTING
```tsx
// Custom SVG component instead of lucide-react
function FileIcon({ className }) {
  return <svg>...</svg>;
}
```
**Result**: Still blank (unexpected)

## Conclusions So Far
- React, Zustand, Tailwind, and custom components work fine
- lucide-react appears to cause blank screen
- Need to investigate why even inline SVG test is blank

## RESOLVED

### Root Cause
The Vite build target in `vite.config.ts` was set to `safari13` (from 2019), which doesn't support modern JavaScript features that `lucide-react` v0.469.0 uses. This caused a silent JavaScript error that crashed React before any content could render.

### Solution
Changed the Vite build target from `safari13` to `safari15` in `vite.config.ts`:

```typescript
build: {
  target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
  // ...
}
```

Safari 15 (released with macOS Monterey in 2021) supports all modern ES features including:
- Class static blocks
- Private class fields
- Top-level await
- Other ES2022+ features that lucide-react uses

### Why This Happened
The original Tauri template was likely created with conservative browser targets. Modern npm packages like lucide-react use newer JavaScript syntax that older Safari versions don't understand, causing the code to fail silently.

## Files Modified During Debugging
- `src-tauri/tauri.conf.json` - Removed invalid fs scope config
- `index.html` - Added `class="dark"` to html element
- `src/App.tsx` - Various test versions
