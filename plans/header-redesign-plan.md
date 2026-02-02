# Header UI Redesign Plan

## Overview
Redesign the top UI elements to create a compact, efficient header with icon buttons for settings, timezone pill, responsive input field, and save button.

## Design Decisions

### Chosen Approach
- **Icon buttons** for three settings (very compact)
- **App title**: Hidden on desktop, visible on mobile
- **Timezone pill** always positioned to the left of input field
- **Responsive input field** (grows on desktop, shrinks on mobile)
- **Two-row layout on mobile**: Settings + title on row 1, timezone + input + save on row 2

### Layout Structure

```
Desktop (≥ 768px):
┌─────────────────────────────────────────────────────────────┐
│ [🔍] [🌙] [❤️]  [Shanghai]  [input field...]  [Save]      │
└─────────────────────────────────────────────────────────────┘

Mobile (< 768px):
┌─────────────────────────────────────────────────────┐
│ [🔍] [🌙] [❤️]  Blood Pressure and Pulse           │
│ [Shanghai] [input field...] [Save]                 │
└─────────────────────────────────────────────────────┘
```

### Icon Mapping
| Setting | Icon | SVG Path | Color (active) |
|---------|------|----------|----------------|
| Filter (morning/evening only) | 🔍 Filter | Magnifying glass path | Blue (#3b82f6) |
| Night Shadows | 🌙 Moon | Moon path | Amber (#f59e0b) |
| Show Pulse | ❤️ Heart | Heart path | Red (#ef4444) |

---

## Implementation Steps

### Step 1: Update HTML Template (`app/templates/index.html`)

**Changes needed:**

1. **Remove old header structure** (lines 4-13):
   - Remove settings toggle button
   - Remove app title text

2. **Remove settings panel** (lines 14-36):
   - The collapsible panel is no longer needed

3. **Create new compact header** with:
   - Three icon toggle buttons (Filter, Night Shadows, Show Pulse)
   - Timezone pill (clickable to open timezone selector)
   - Input field (responsive width)
   - Save button

4. **Add timezone dropdown modal**:
   - Hidden by default
   - Opens when timezone pill is clicked
   - Contains timezone selector options

5. **Update JavaScript**:
   - Remove settings panel toggle logic
   - Add icon button toggle logic (update visual state)
   - Add timezone modal open/close logic
   - Maintain localStorage persistence for all settings

---

### Step 2: Update CSS Styles (`app/static/style.css`)

**New styles needed:**

1. **Icon toggle buttons**:
   - Square buttons (40x40px or similar)
   - Icon centered
   - Active state styling (filled color)
   - Inactive state styling (gray/outline)
   - Hover effects
   - Focus states for accessibility

2. **Compact header container**:
   - Flexbox layout
   - Gap between elements
   - Responsive wrapping (mobile breakpoint)

3. **Responsive input field**:
   - `flex: 1` to grow on desktop
   - `min-width` constraint on mobile
   - Reduced padding/height for compactness

4. **Timezone modal**:
   - Overlay background
   - Centered modal box
   - Close button
   - Timezone list styling

5. **Dark mode support**:
   - Ensure all new elements work in dark mode

---

## Detailed HTML Structure

```html
<!-- New compact header -->
<div class="compact-header mb-4">
  <!-- Row 1: Settings + Title (mobile only) -->
  <div class="header-row-1 flex items-center gap-2 mb-2">
    <!-- Settings icon buttons -->
    <button type="button" id="btn-filter" class="icon-btn" title="Filter: Morning/Evening only">
      <svg>...</svg>
    </button>
    <button type="button" id="btn-night" class="icon-btn" title="Night shadows">
      <svg>...</svg>
    </button>
    <button type="button" id="btn-pulse" class="icon-btn" title="Show pulse on chart">
      <svg>...</svg>
    </button>

    <!-- App title (mobile only) -->
    <h1 class="app-title-mobile">Blood Pressure and Pulse</h1>
  </div>

  <!-- Row 2: Timezone + Input + Save -->
  <div class="header-row-2 flex items-center gap-2">
    <!-- Timezone pill (clickable) -->
    <button type="button" id="tz-pill" class="tz-badge {{ timezone_info.badge_class }}">
      {{ timezone_info.city }}
    </button>

    <!-- Entry form -->
    <form id="entry-form" class="flex items-center gap-2 flex-1 min-w-[200px]"
          action="/add" method="post"
          hx-post="/add" hx-target="#page" hx-swap="outerHTML">
      <input type="hidden" name="local_tz" id="local_tz_input" />
      <input name="line" type="text" class="input-compact"
             placeholder="e.g.: 120 80 56"
             inputmode="numeric"
             value="{{ input_value or '' }}" />
      <button type="submit" class="btn-save">Save</button>
    </form>
  </div>
</div>

<!-- Timezone selector modal (hidden by default) -->
<div id="tz-modal" class="modal hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Select Timezone</h3>
      <button type="button" id="tz-modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Timezone options populated by JS -->
    </div>
  </div>
</div>
```

---

## Detailed CSS Structure

```css
/* Compact header container */
.compact-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Icon toggle buttons */
.icon-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn svg {
  width: 20px;
  height: 20px;
  stroke: #9ca3af;
  fill: none;
  stroke-width: 2;
}

.icon-btn:hover {
  border-color: #9ca3af;
}

.icon-btn.active {
  border-color: transparent;
}

/* Active state colors */
.icon-btn.active svg {
  stroke: currentColor;
}

.icon-btn#btn-filter.active {
  background: #3b82f6;
  color: white;
}

.icon-btn#btn-night.active {
  background: #f59e0b;
  color: white;
}

.icon-btn#btn-pulse.active {
  background: #ef4444;
  color: white;
}

/* Compact input field */
.input-compact {
  flex: 1;
  min-width: 150px;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

/* Save button */
.btn-save {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover {
  background: #2563eb;
}

/* Timezone modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 20px;
  min-width: 300px;
  max-width: 90vw;
}

/* Mobile responsive */
@media (max-width: 767px) {
  .header-row-1 {
    flex-wrap: wrap;
  }

  .icon-btn {
    width: 36px;
    height: 36px;
  }

  .app-title-mobile {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }

  .input-compact {
    max-width: none;
    min-width: 120px;
  }
}

/* Desktop: hide title, single row */
@media (min-width: 768px) {
  .compact-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
  }

  .header-row-1,
  .header-row-2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
  }

  .app-title-mobile {
    display: none;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .icon-btn {
    background: #374151;
    border-color: #4b5563;
  }

  .input-compact {
    background: #1f2937;
    border-color: #4b5563;
    color: #f3f4f6;
  }

  .modal-content {
    background: #1f2937;
  }

  .app-title-mobile {
    color: #f3f4f6;
  }
}
```

---

## JavaScript Changes

### Remove
- Settings panel toggle event listener (line 130-133)
- Settings panel HTML references

### Add
1. **Icon button toggle logic**:
   ```javascript
   function updateIconButtons() {
     const filter = JSON.parse(localStorage.getItem('filter_me_only') || 'false');
     const night = JSON.parse(localStorage.getItem('night_shadows') || 'false');
     const pulse = JSON.parse(localStorage.getItem('showPulse') || 'true');

     document.getElementById('btn-filter').classList.toggle('active', filter);
     document.getElementById('btn-night').classList.toggle('active', night);
     document.getElementById('btn-pulse').classList.toggle('active', pulse);
   }

   document.getElementById('btn-filter').addEventListener('click', () => {
     const current = JSON.parse(localStorage.getItem('filter_me_only') || 'false');
     localStorage.setItem('filter_me_only', JSON.stringify(!current));
     updateIconButtons();
     // Re-render chart
   });
   // Similar for night and pulse buttons
   ```

2. **Timezone modal logic**:
   ```javascript
   const tzModal = document.getElementById('tz-modal');
   const tzPill = document.getElementById('tz-pill');

   tzPill.addEventListener('click', () => {
     tzModal.classList.remove('hidden');
   });

   document.getElementById('tz-modal-close').addEventListener('click', () => {
     tzModal.classList.add('hidden');
   });

   // Close on backdrop click
   tzModal.addEventListener('click', (e) => {
     if (e.target === tzModal) {
       tzModal.classList.add('hidden');
     }
   });
   ```

3. **Timezone selection in modal**:
   - Populate timezone options in modal body
   - Handle timezone selection
   - Update badge and localStorage
   - Close modal

---

## SVG Icons

### Filter Icon (Magnifying Glass)
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <circle cx="11" cy="11" r="8"/>
  <path d="M21 21l-4.35-4.35"/>
</svg>
```

### Night Shadows Icon (Moon)
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>
```

### Show Pulse Icon (Heart)
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
</svg>
```

---

## Testing Checklist

- [ ] All three icon buttons toggle correctly
- [ ] Active/inactive visual states are clear
- [ ] Settings persist in localStorage
- [ ] Timezone pill shows correct city
- [ ] Timezone modal opens/closes correctly
- [ ] Timezone selection updates badge and localStorage
- [ ] Input field accepts values correctly
- [ ] Save button submits form
- [ ] Desktop layout: single row (no title visible)
- [ ] Mobile layout: two rows (settings + title on row 1, timezone + input + save on row 2)
- [ ] Dark mode styling works correctly
- [ ] Focus states for accessibility
- [ ] Keyboard navigation works
- [ ] Chart re-renders when settings change

---

## Files to Modify

1. **`app/templates/index.html`** - Complete header section restructure
2. **`app/static/style.css`** - Add new styles for icon buttons, modal, responsive layout
3. No backend changes needed (FastAPI routes remain the same)

---

## Notes

- The timezone dropdown from the old settings panel will be replaced with a modal that opens when clicking the timezone pill
- All existing localStorage keys remain the same for backward compatibility
- The chart re-rendering logic remains the same, just triggered from icon buttons instead of checkboxes
- HTMX behavior for form submission remains unchanged
