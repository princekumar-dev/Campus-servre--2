# CampusServe UI/UX Design System Guide

This guide is a complete, end-to-end reference of every premium design element, typography effect, global animation, layout pattern, and button style used in the application. Use this to seamlessly replicate the high-end aesthetic on any other page.

---

## 1. Color Palette

- **MSEC Gold (Brand Primary):** `#C9A84C` (Also defined as CSS vars: `--theme-gold-600`, `--theme-gold-300`)
- **Primary Actions:** `blue-600` to `indigo-600`
- **Success/Arrivals:** `green-500` to `emerald-600`
- **Destructive/Clear:** `red-500` to `red-600`
- **Dark Theme Elements:** `gray-900` to `black`

---

## 2. Typography & Text Effects

### The "Wave Text" Gold Gradient (Animated)
This is a premium, animated text gradient used for important headings or brand names. It smoothly shifts shades of gold across the text.

**Requires `index.css`:**
```css
.wave-text {
  background: linear-gradient(90deg, var(--theme-gold-600), var(--theme-gold-300), var(--theme-gold-600), var(--theme-gold-300));
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: wave-animation 3s ease-in-out infinite;
  transition: all 0.3s ease;
}

.wave-text:hover {
  animation-duration: 1s;
  transform: scale(1.1);
}

@keyframes wave-animation {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

**JSX Usage:**
```jsx
<h1 className="wave-text font-bold text-3xl">CampusServe</h1>
```

---

## 3. Global CSS Animations (`index.css`)

The app has built-in utility classes for smooth entrance animations. You can add these classes to any component for instant polish.

- **Fade In:** `.animate-fadeIn` (0.2s ease-out)
- **Slide Up:** `.animate-slideUp` (0.3s ease-out)
- **Slide In Right:** `.animate-slideInRight` (0.3s ease-out)

**JSX Usage:**
```jsx
<div className="animate-slideUp bg-white rounded-2xl shadow p-5">
  {/* Content slides up smoothly on load */}
</div>
```

---

## 4. Layouts & Containers

### Main Card Layout
Use this for any main form or list container.
```jsx
<div className="bg-white rounded-2xl shadow p-5 mb-6 space-y-5 animate-fadeIn">
   {/* Form contents go here */}
</div>
```

### Segmented Control (Toggle Tabs)
A sleek, iOS-style toggle for switching between views.

**Requires `index.css`:**
```css
.segmented-control { position: relative; }
.segmented-highlight { 
  position: absolute; 
  top: 0.25rem; 
  bottom: 0.25rem; 
  background: rgba(37,99,235,0.08); 
  border: 1px solid rgba(37,99,235,0.2); 
  border-radius: 0.75rem; 
  transition: left 200ms ease; 
}
```
**JSX:**
```jsx
<div className="segmented-control relative p-1 rounded-xl bg-white shadow-sm border border-gray-100">
  <div 
    className="segmented-highlight"
    style={{ left: activeTab === 'opt1' ? '0.25rem' : 'calc(50% + 0.25rem)', width: 'calc(50% - 0.5rem)' }} 
  />
  <div className="grid grid-cols-2 gap-0">
    <button onClick={() => setActiveTab('opt1')} className={`relative z-10 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'opt1' ? 'text-blue-700' : 'text-blue-600 hover:bg-blue-50'}`}>Option 1</button>
    <button onClick={() => setActiveTab('opt2')} className={`relative z-10 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'opt2' ? 'text-blue-700' : 'text-blue-600 hover:bg-blue-50'}`}>Option 2</button>
  </div>
</div>
```

---

## 5. Button Styles & Hover Effects

### Primary Outline Button (MSEC Gold)
Starts outlined and fills with solid gold color when hovered.
```jsx
<button 
  disabled={isLoading}
  style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
  onMouseEnter={e => { e.currentTarget.style.backgroundColor='#C9A84C'; e.currentTarget.style.color='white' }}
  onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='#C9A84C' }}
  className="px-4 py-2.5 rounded-lg bg-transparent font-semibold text-sm border-2 disabled:opacity-50 transition-all shadow-md hover:shadow-lg disabled:shadow-none transform hover:scale-105 active:scale-95"
>
  Submit Request
</button>
```

### The "Wave Login" Button
A button that constantly ripples with the gold gradient.
**JSX:**
```jsx
<button className="wave-login-btn text-white font-bold py-3 px-6 rounded-xl shadow-lg">
  Login
</button>
```

### Destructive / Clear Button (Red)
```jsx
<button className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-white hover:text-red-600 font-semibold text-sm transition-all shadow-sm hover:shadow-md hover:shadow-red-500/50 border-2 border-red-600 transform hover:scale-105 active:scale-95">
  Clear Form
</button>
```

### Glowing Success Button (Green)
```jsx
<button className="w-full px-4 py-4 font-bold text-lg rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white transform hover:scale-[1.02]">
  ✅ Confirm Action
</button>
```

---

## 6. Inputs & Forms

### Premium Text Area (With Character Limit Glow)
```jsx
<div className="relative">
  <textarea 
    rows={4}
    className={`w-full border rounded-xl px-4 py-3 pb-8 transition-all resize-none shadow-sm 
      ${hasError ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} 
      ${isNearLimit ? 'pulse-glow' : ''}`}
    placeholder="Type here..." 
  />
  <div className="absolute right-3 bottom-3 text-xs text-gray-400 font-medium pointer-events-none">
    {currentLength}/{maxLength}
  </div>
</div>
```

### File Upload Button (Hidden Native Input)
```jsx
<label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2.5 rounded-lg border border-blue-200 text-sm font-medium transition-colors flex items-center gap-2">
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
  Attach Image
  <input type="file" accept="image/*" className="hidden" />
</label>
```

---

## 7. Advanced Custom Layouts

### Glassmorphism / Station Clock Card
A premium dark-themed card used for live tracking, timers, or very important focus areas.
```jsx
<div className="px-5 py-6 bg-gradient-to-br from-gray-900 to-black rounded-xl text-white shadow-xl relative overflow-hidden animate-slideUp">
  {/* Top Accent Line */}
  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
  
  <div className="flex justify-between items-start mb-4">
    <div>
      <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        Live Status
      </div>
      <div className="font-semibold text-lg">In Progress</div>
    </div>
  </div>

  {/* Inner Dark Card for Data */}
  <div className="bg-black/50 rounded-lg p-4 border border-gray-800 flex flex-col items-center justify-center min-h-[100px]">
     <div className="text-4xl sm:text-5xl font-bold font-mono tracking-wider text-green-400" style={{ textShadow: '0 0 10px rgba(74, 222, 128, 0.3)' }}>
        00:00:00
     </div>
  </div>
</div>
```
