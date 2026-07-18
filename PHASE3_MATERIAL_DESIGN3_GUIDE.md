# Phase 3: Material Design 3 Redesign Guide

## Overview
ScrollTracker uses React Native with Tailwind/NativeWind. The app currently has a functional dark theme but needs Material Design 3 polish to be production-ready.

## Implementation Steps

### 1. Replace Emoji with Material Icons
Current: Uses emoji badges (🔥, 📊, ⚙️, etc.)
Target: Use @react-native-vector-icons/MaterialCommunityIcons

```javascript
// Before
<Text>🔥 {streak} day streak</Text>

// After
import { MaterialCommunityIcons } from '@expo/vector-icons';
<View className="flex-row items-center">
  <MaterialCommunityIcons name="fire" size={16} color="#FF6B35" />
  <Text className="text-white ml-1">{streak} day streak</Text>
</View>
```

### 2. Icon Mapping
- 🔥 → fire (color: #FF6B35)
- 📊 → chart-line (color: #6366F1)
- ⚙️ → cog (color: #64748B)
- ✓ → check-circle (color: #10B981)
- ✗ → alert-circle (color: #EF4444)
- 📤 → cloud-upload (color: #6366F1)
- 🔒 → lock (color: #64748B)

### 3. Color System (Material Design 3)
```
Primary: #6366F1 (Indigo)
Secondary: #14B8A6 (Teal)
Tertiary: #F59E0B (Amber)
Success: #10B981 (Emerald)
Danger: #EF4444 (Red)
Warning: #FF6B35 (Orange)
Info: #3B82F6 (Blue)

Background: #0F172A (Slate-900)
Surface: #1E293B (Slate-800)
SurfaceAlt: #334155 (Slate-700)
Muted: #94A3B8 (Slate-400)
```

### 4. Typography Hierarchy
- Display: text-3xl/text-4xl font-bold (titles)
- Headline: text-2xl font-bold (section headers)
- Title: text-xl font-semibold (card titles)
- Body: text-base font-normal (content)
- Label: text-sm font-medium (labels)
- Caption: text-xs font-normal (hints)

### 5. Components to Update

#### Dashboard (app/(tabs)/dashboard.jsx)
- [ ] Replace streak emoji with fire icon
- [ ] Add Material Card elevation/shadows
- [ ] Improve spacing and padding consistency
- [ ] Add state indicator icons (tracking active/paused)

#### Analytics (app/(tabs)/analytics.jsx)
- [ ] Replace chart emoji with chart-line icon
- [ ] Add export icon (cloud-upload) to export button
- [ ] Improve stat card appearance
- [ ] Add trend indicators

#### Settings (app/(tabs)/settings.jsx)
- [ ] Replace emoji with settings cog icon
- [ ] Add icons to each setting option
- [ ] Improve permission status indicators
- [ ] Better visual distinction for enabled/disabled switches

#### Goals (app/(tabs)/goals.jsx)
- [ ] Add goal-related icons
- [ ] Improve progress visualization
- [ ] Better status indicators

#### Focus (app/(tabs)/focus.jsx)
- [ ] Add timer/focus mode icons
- [ ] Improve visual feedback

### 6. Spacing Improvements
Current: Inconsistent padding/gaps
Target:
- Compact: 8px (gap-1, p-1)
- Default: 16px (gap-4, p-4)
- Spacious: 24px (gap-6, p-6)
- Section: 32px (gap-8, mb-8)

### 7. Component Refinements

#### Buttons
```jsx
// Before: Plain Pressable
<Pressable className="bg-primary rounded-2xl py-4">

// After: Material Button
<Pressable className="bg-primary rounded-lg py-3 px-6 flex-row items-center justify-center gap-2 active:opacity-80">
  <MaterialCommunityIcons name="check" size={18} color="white" />
  <Text className="text-white font-semibold">Action Label</Text>
</Pressable>
```

#### Cards
```jsx
// Before: Simple border
<View className="bg-surface rounded-2xl p-4 border border-surfaceAlt">

// After: Material Surface
<View className="bg-surface rounded-lg p-4 border border-surfaceAlt shadow-sm">
```

#### Status Indicators
```jsx
// Before: Plain text
<Text>Granted</Text>

// After: Icon + Text
<View className="flex-row items-center gap-1">
  <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
  <Text className="text-success text-sm">Granted</Text>
</View>
```

### 8. Installation Requirements
```bash
# If not already installed
npm install @expo/vector-icons
# or
npx expo install @expo/vector-icons
```

### 9. Implementation Order
1. Install @expo/vector-icons
2. Create Icon component wrapper (optional)
3. Update Dashboard screen
4. Update Analytics screen
5. Update Settings screen
6. Update Goals screen
7. Update Focus screen
8. Update PlatformCard component
9. Update PermissionGateBanner component
10. Test on device (emulator may not render icons perfectly)

### 10. Testing Checklist
- [ ] All icons render correctly
- [ ] Icons are properly colored
- [ ] Icons align with text baseline
- [ ] Touch targets remain ≥44x44pt
- [ ] Works in both light and dark mode
- [ ] Icons display on Android and iOS
- [ ] No console warnings

## Note
This is a UI-only phase. No business logic changes are needed. All updates are visual improvements to match Material Design 3 standards.

