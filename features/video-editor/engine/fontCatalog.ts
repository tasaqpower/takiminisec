/**
 * FORMA Video Editor — Comprehensive 200+ Typography Engine & Google Font Catalog
 * High-fidelity Turkish character support (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü)
 * Categorized into Modern Sans, Cinematic Serif, Bold Display, Script/Handwritten, Monospace, and Futuristic.
 */

export type FontCategory = 'all' | 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'futuristic';

export interface FontItem {
  id: string; // Used in CSS / canvas font-family, e.g. "Montserrat"
  name: string; // User-facing label
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'futuristic';
  googleFontName: string; // For Google Fonts API URL
  fallback: string;
}

export const FONT_CATEGORIES: { id: FontCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Tümü (200+)', icon: '✨' },
  { id: 'sans-serif', label: 'Modern & Sade', icon: '🔤' },
  { id: 'serif', label: 'Lüks & Serif', icon: '🏛️' },
  { id: 'display', label: 'Manşet & Poster', icon: '💥' },
  { id: 'handwriting', label: 'El Yazısı & İmza', icon: '✍️' },
  { id: 'monospace', label: 'Daktilo & Kod', icon: '⌨️' },
  { id: 'futuristic', label: 'Siber & Fütüristik', icon: '⚡' },
];

export const FONT_CATALOG: FontItem[] = [
  // ==========================================
  // 1. MODERN & SANS-SERIF (45 FONTS)
  // ==========================================
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', category: 'sans-serif', googleFontName: 'Plus+Jakarta+Sans', fallback: 'sans-serif' },
  { id: 'Inter', name: 'Inter', category: 'sans-serif', googleFontName: 'Inter', fallback: 'sans-serif' },
  { id: 'Montserrat', name: 'Montserrat', category: 'sans-serif', googleFontName: 'Montserrat', fallback: 'sans-serif' },
  { id: 'Roboto', name: 'Roboto', category: 'sans-serif', googleFontName: 'Roboto', fallback: 'sans-serif' },
  { id: 'Poppins', name: 'Poppins', category: 'sans-serif', googleFontName: 'Poppins', fallback: 'sans-serif' },
  { id: 'Open Sans', name: 'Open Sans', category: 'sans-serif', googleFontName: 'Open+Sans', fallback: 'sans-serif' },
  { id: 'Lato', name: 'Lato', category: 'sans-serif', googleFontName: 'Lato', fallback: 'sans-serif' },
  { id: 'Nunito', name: 'Nunito', category: 'sans-serif', googleFontName: 'Nunito', fallback: 'sans-serif' },
  { id: 'Raleway', name: 'Raleway', category: 'sans-serif', googleFontName: 'Raleway', fallback: 'sans-serif' },
  { id: 'Work Sans', name: 'Work Sans', category: 'sans-serif', googleFontName: 'Work+Sans', fallback: 'sans-serif' },
  { id: 'DM Sans', name: 'DM Sans', category: 'sans-serif', googleFontName: 'DM+Sans', fallback: 'sans-serif' },
  { id: 'Rubik', name: 'Rubik', category: 'sans-serif', googleFontName: 'Rubik', fallback: 'sans-serif' },
  { id: 'Fira Sans', name: 'Fira Sans', category: 'sans-serif', googleFontName: 'Fira+Sans', fallback: 'sans-serif' },
  { id: 'Quicksand', name: 'Quicksand', category: 'sans-serif', googleFontName: 'Quicksand', fallback: 'sans-serif' },
  { id: 'Barlow', name: 'Barlow', category: 'sans-serif', googleFontName: 'Barlow', fallback: 'sans-serif' },
  { id: 'Manrope', name: 'Manrope', category: 'sans-serif', googleFontName: 'Manrope', fallback: 'sans-serif' },
  { id: 'Kanit', name: 'Kanit', category: 'sans-serif', googleFontName: 'Kanit', fallback: 'sans-serif' },
  { id: 'Ubuntu', name: 'Ubuntu', category: 'sans-serif', googleFontName: 'Ubuntu', fallback: 'sans-serif' },
  { id: 'Cabin', name: 'Cabin', category: 'sans-serif', googleFontName: 'Cabin', fallback: 'sans-serif' },
  { id: 'Heebo', name: 'Heebo', category: 'sans-serif', googleFontName: 'Heebo', fallback: 'sans-serif' },
  { id: 'Prompt', name: 'Prompt', category: 'sans-serif', googleFontName: 'Prompt', fallback: 'sans-serif' },
  { id: 'PT Sans', name: 'PT Sans', category: 'sans-serif', googleFontName: 'PT+Sans', fallback: 'sans-serif' },
  { id: 'Oxygen', name: 'Oxygen', category: 'sans-serif', googleFontName: 'Oxygen', fallback: 'sans-serif' },
  { id: 'Karla', name: 'Karla', category: 'sans-serif', googleFontName: 'Karla', fallback: 'sans-serif' },
  { id: 'Mukta', name: 'Mukta', category: 'sans-serif', googleFontName: 'Mukta', fallback: 'sans-serif' },
  { id: 'Overpass', name: 'Overpass', category: 'sans-serif', googleFontName: 'Overpass', fallback: 'sans-serif' },
  { id: 'Titillium Web', name: 'Titillium Web', category: 'sans-serif', googleFontName: 'Titillium+Web', fallback: 'sans-serif' },
  { id: 'Assistant', name: 'Assistant', category: 'sans-serif', googleFontName: 'Assistant', fallback: 'sans-serif' },
  { id: 'Albert Sans', name: 'Albert Sans', category: 'sans-serif', googleFontName: 'Albert+Sans', fallback: 'sans-serif' },
  { id: 'Figtree', name: 'Figtree', category: 'sans-serif', googleFontName: 'Figtree', fallback: 'sans-serif' },
  { id: 'Outfit', name: 'Outfit', category: 'sans-serif', googleFontName: 'Outfit', fallback: 'sans-serif' },
  { id: 'Space Grotesk', name: 'Space Grotesk', category: 'sans-serif', googleFontName: 'Space+Grotesk', fallback: 'sans-serif' },
  { id: 'Syne', name: 'Syne', category: 'sans-serif', googleFontName: 'Syne', fallback: 'sans-serif' },
  { id: 'Urbanist', name: 'Urbanist', category: 'sans-serif', googleFontName: 'Urbanist', fallback: 'sans-serif' },
  { id: 'Lexend', name: 'Lexend', category: 'sans-serif', googleFontName: 'Lexend', fallback: 'sans-serif' },
  { id: 'Be Vietnam Pro', name: 'Be Vietnam Pro', category: 'sans-serif', googleFontName: 'Be+Vietnam+Pro', fallback: 'sans-serif' },
  { id: 'Epilogue', name: 'Epilogue', category: 'sans-serif', googleFontName: 'Epilogue', fallback: 'sans-serif' },
  { id: 'Archivo', name: 'Archivo', category: 'sans-serif', googleFontName: 'Archivo', fallback: 'sans-serif' },
  { id: 'Red Hat Display', name: 'Red Hat Display', category: 'sans-serif', googleFontName: 'Red+Hat+Display', fallback: 'sans-serif' },
  { id: 'Exo 2', name: 'Exo 2', category: 'sans-serif', googleFontName: 'Exo+2', fallback: 'sans-serif' },
  { id: 'Jost', name: 'Jost', category: 'sans-serif', googleFontName: 'Jost', fallback: 'sans-serif' },
  { id: 'Chivo', name: 'Chivo', category: 'sans-serif', googleFontName: 'Chivo', fallback: 'sans-serif' },
  { id: 'Sora', name: 'Sora', category: 'sans-serif', googleFontName: 'Sora', fallback: 'sans-serif' },
  { id: 'Mulish', name: 'Mulish', category: 'sans-serif', googleFontName: 'Mulish', fallback: 'sans-serif' },
  { id: 'Bricolage Grotesque', name: 'Bricolage Grotesque', category: 'sans-serif', googleFontName: 'Bricolage+Grotesque', fallback: 'sans-serif' },

  // ==========================================
  // 2. LUXURY & CINEMATIC SERIF (35 FONTS)
  // ==========================================
  { id: 'Playfair Display', name: 'Playfair Display', category: 'serif', googleFontName: 'Playfair+Display', fallback: 'serif' },
  { id: 'Merriweather', name: 'Merriweather', category: 'serif', googleFontName: 'Merriweather', fallback: 'serif' },
  { id: 'Lora', name: 'Lora', category: 'serif', googleFontName: 'Lora', fallback: 'serif' },
  { id: 'PT Serif', name: 'PT Serif', category: 'serif', googleFontName: 'PT+Serif', fallback: 'serif' },
  { id: 'Cinzel', name: 'Cinzel', category: 'serif', googleFontName: 'Cinzel', fallback: 'serif' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond', category: 'serif', googleFontName: 'Cormorant+Garamond', fallback: 'serif' },
  { id: 'Libre Baskerville', name: 'Libre Baskerville', category: 'serif', googleFontName: 'Libre+Baskerville', fallback: 'serif' },
  { id: 'EB Garamond', name: 'EB Garamond', category: 'serif', googleFontName: 'EB+Garamond', fallback: 'serif' },
  { id: 'Noto Serif', name: 'Noto Serif', category: 'serif', googleFontName: 'Noto+Serif', fallback: 'serif' },
  { id: 'Arvo', name: 'Arvo', category: 'serif', googleFontName: 'Arvo', fallback: 'serif' },
  { id: 'Bodoni Moda', name: 'Bodoni Moda', category: 'serif', googleFontName: 'Bodoni+Moda', fallback: 'serif' },
  { id: 'Crimson Text', name: 'Crimson Text', category: 'serif', googleFontName: 'Crimson+Text', fallback: 'serif' },
  { id: 'Bitter', name: 'Bitter', category: 'serif', googleFontName: 'Bitter', fallback: 'serif' },
  { id: 'DM Serif Display', name: 'DM Serif Display', category: 'serif', googleFontName: 'DM+Serif+Display', fallback: 'serif' },
  { id: 'Spectral', name: 'Spectral', category: 'serif', googleFontName: 'Spectral', fallback: 'serif' },
  { id: 'Castoro', name: 'Castoro', category: 'serif', googleFontName: 'Castoro', fallback: 'serif' },
  { id: 'Prata', name: 'Prata', category: 'serif', googleFontName: 'Prata', fallback: 'serif' },
  { id: 'Faustina', name: 'Faustina', category: 'serif', googleFontName: 'Faustina', fallback: 'serif' },
  { id: 'Vollkorn', name: 'Vollkorn', category: 'serif', googleFontName: 'Vollkorn', fallback: 'serif' },
  { id: 'Cardo', name: 'Cardo', category: 'serif', googleFontName: 'Cardo', fallback: 'serif' },
  { id: 'Marcellus', name: 'Marcellus', category: 'serif', googleFontName: 'Marcellus', fallback: 'serif' },
  { id: 'Rozha One', name: 'Rozha One', category: 'serif', googleFontName: 'Rozha+One', fallback: 'serif' },
  { id: 'Newsreader', name: 'Newsreader', category: 'serif', googleFontName: 'Newsreader', fallback: 'serif' },
  { id: 'Besley', name: 'Besley', category: 'serif', googleFontName: 'Besley', fallback: 'serif' },
  { id: 'Bellefair', name: 'Bellefair', category: 'serif', googleFontName: 'Bellefair', fallback: 'serif' },
  { id: 'Forum', name: 'Forum', category: 'serif', googleFontName: 'Forum', fallback: 'serif' },
  { id: 'Alice', name: 'Alice', category: 'serif', googleFontName: 'Alice', fallback: 'serif' },
  { id: 'Old Standard TT', name: 'Old Standard TT', category: 'serif', googleFontName: 'Old+Standard+TT', fallback: 'serif' },
  { id: 'Cinzel Decorative', name: 'Cinzel Decorative', category: 'serif', googleFontName: 'Cinzel+Decorative', fallback: 'serif' },
  { id: 'GFS Didot', name: 'GFS Didot', category: 'serif', googleFontName: 'GFS+Didot', fallback: 'serif' },
  { id: 'Italiana', name: 'Italiana', category: 'serif', googleFontName: 'Italiana', fallback: 'serif' },
  { id: 'Arapey', name: 'Arapey', category: 'serif', googleFontName: 'Arapey', fallback: 'serif' },
  { id: 'Yeseva One', name: 'Yeseva One', category: 'serif', googleFontName: 'Yeseva+One', fallback: 'serif' },
  { id: 'Castoro Titling', name: 'Castoro Titling', category: 'serif', googleFontName: 'Castoro+Titling', fallback: 'serif' },
  { id: 'Bona Nova', name: 'Bona Nova', category: 'serif', googleFontName: 'Bona+Nova', fallback: 'serif' },

  // ==========================================
  // 3. HEADLINE & BOLD DISPLAY (40 FONTS)
  // ==========================================
  { id: 'Oswald', name: 'Oswald', category: 'display', googleFontName: 'Oswald', fallback: 'sans-serif' },
  { id: 'Bebas Neue', name: 'Bebas Neue', category: 'display', googleFontName: 'Bebas+Neue', fallback: 'sans-serif' },
  { id: 'Anton', name: 'Anton', category: 'display', googleFontName: 'Anton', fallback: 'sans-serif' },
  { id: 'Righteous', name: 'Righteous', category: 'display', googleFontName: 'Righteous', fallback: 'cursive' },
  { id: 'Russo One', name: 'Russo One', category: 'display', googleFontName: 'Russo+One', fallback: 'sans-serif' },
  { id: 'Bangers', name: 'Bangers', category: 'display', googleFontName: 'Bangers', fallback: 'cursive' },
  { id: 'Bungee', name: 'Bungee', category: 'display', googleFontName: 'Bungee', fallback: 'cursive' },
  { id: 'Fredoka', name: 'Fredoka', category: 'display', googleFontName: 'Fredoka', fallback: 'sans-serif' },
  { id: 'Passion One', name: 'Passion One', category: 'display', googleFontName: 'Passion+One', fallback: 'cursive' },
  { id: 'Alfa Slab One', name: 'Alfa Slab One', category: 'display', googleFontName: 'Alfa+Slab+One', fallback: 'serif' },
  { id: 'Black Han Sans', name: 'Black Han Sans', category: 'display', googleFontName: 'Black+Han+Sans', fallback: 'sans-serif' },
  { id: 'Titan One', name: 'Titan One', category: 'display', googleFontName: 'Titan+One', fallback: 'cursive' },
  { id: 'Shrikhand', name: 'Shrikhand', category: 'display', googleFontName: 'Shrikhand', fallback: 'cursive' },
  { id: 'Ultra', name: 'Ultra', category: 'display', googleFontName: 'Ultra', fallback: 'serif' },
  { id: 'Paytone One', name: 'Paytone One', category: 'display', googleFontName: 'Paytone+One', fallback: 'sans-serif' },
  { id: 'Abril Fatface', name: 'Abril Fatface', category: 'display', googleFontName: 'Abril+Fatface', fallback: 'serif' },
  { id: 'Carter One', name: 'Carter One', category: 'display', googleFontName: 'Carter+One', fallback: 'cursive' },
  { id: 'Fugaz One', name: 'Fugaz One', category: 'display', googleFontName: 'Fugaz+One', fallback: 'cursive' },
  { id: 'Monoton', name: 'Monoton', category: 'display', googleFontName: 'Monoton', fallback: 'cursive' },
  { id: 'Audiowide', name: 'Audiowide', category: 'display', googleFontName: 'Audiowide', fallback: 'cursive' },
  { id: 'Changa', name: 'Changa', category: 'display', googleFontName: 'Changa', fallback: 'sans-serif' },
  { id: 'Rowdies', name: 'Rowdies', category: 'display', googleFontName: 'Rowdies', fallback: 'cursive' },
  { id: 'Archivo Black', name: 'Archivo Black', category: 'display', googleFontName: 'Archivo+Black', fallback: 'sans-serif' },
  { id: 'Squada One', name: 'Squada One', category: 'display', googleFontName: 'Squada+One', fallback: 'cursive' },
  { id: 'Bowlby One', name: 'Bowlby One', category: 'display', googleFontName: 'Bowlby+One', fallback: 'cursive' },
  { id: 'Chango', name: 'Chango', category: 'display', googleFontName: 'Chango', fallback: 'cursive' },
  { id: 'Faster One', name: 'Faster One', category: 'display', googleFontName: 'Faster+One', fallback: 'cursive' },
  { id: 'Plaster', name: 'Plaster', category: 'display', googleFontName: 'Plaster', fallback: 'cursive' },
  { id: 'Megrim', name: 'Megrim', category: 'display', googleFontName: 'Megrim', fallback: 'cursive' },
  { id: 'Staatliches', name: 'Staatliches', category: 'display', googleFontName: 'Staatliches', fallback: 'display' },
  { id: 'Secular One', name: 'Secular One', category: 'display', googleFontName: 'Secular+One', fallback: 'sans-serif' },
  { id: 'Rammetto One', name: 'Rammetto One', category: 'display', googleFontName: 'Rammetto+One', fallback: 'cursive' },
  { id: 'Londrina Solid', name: 'Londrina Solid', category: 'display', googleFontName: 'Londrina+Solid', fallback: 'cursive' },
  { id: 'Koulen', name: 'Koulen', category: 'display', googleFontName: 'Koulen', fallback: 'display' },
  { id: 'Creepster', name: 'Creepster', category: 'display', googleFontName: 'Creepster', fallback: 'cursive' },
  { id: 'Eater', name: 'Eater', category: 'display', googleFontName: 'Eater', fallback: 'cursive' },
  { id: 'Nosifer', name: 'Nosifer', category: 'display', googleFontName: 'Nosifer', fallback: 'cursive' },
  { id: 'Fascinate Inline', name: 'Fascinate Inline', category: 'display', googleFontName: 'Fascinate+Inline', fallback: 'display' },
  { id: 'Knewave', name: 'Knewave', category: 'display', googleFontName: 'Knewave', fallback: 'display' },
  { id: 'Kelly Slab', name: 'Kelly Slab', category: 'display', googleFontName: 'Kelly+Slab', fallback: 'serif' },

  // ==========================================
  // 4. SCRIPT & HANDWRITTEN (35 FONTS)
  // ==========================================
  { id: 'Pacifico', name: 'Pacifico', category: 'handwriting', googleFontName: 'Pacifico', fallback: 'cursive' },
  { id: 'Caveat', name: 'Caveat', category: 'handwriting', googleFontName: 'Caveat', fallback: 'cursive' },
  { id: 'Dancing Script', name: 'Dancing Script', category: 'handwriting', googleFontName: 'Dancing+Script', fallback: 'cursive' },
  { id: 'Satisfy', name: 'Satisfy', category: 'handwriting', googleFontName: 'Satisfy', fallback: 'cursive' },
  { id: 'Great Vibes', name: 'Great Vibes', category: 'handwriting', googleFontName: 'Great+Vibes', fallback: 'cursive' },
  { id: 'Sacramento', name: 'Sacramento', category: 'handwriting', googleFontName: 'Sacramento', fallback: 'cursive' },
  { id: 'Shadows Into Light', name: 'Shadows Into Light', category: 'handwriting', googleFontName: 'Shadows+Into+Light', fallback: 'cursive' },
  { id: 'Indie Flower', name: 'Indie Flower', category: 'handwriting', googleFontName: 'Indie+Flower', fallback: 'cursive' },
  { id: 'Kaushan Script', name: 'Kaushan Script', category: 'handwriting', googleFontName: 'Kaushan+Script', fallback: 'cursive' },
  { id: 'Amatic SC', name: 'Amatic SC', category: 'handwriting', googleFontName: 'Amatic+SC', fallback: 'cursive' },
  { id: 'Gloria Hallelujah', name: 'Gloria Hallelujah', category: 'handwriting', googleFontName: 'Gloria+Hallelujah', fallback: 'cursive' },
  { id: 'Courgette', name: 'Courgette', category: 'handwriting', googleFontName: 'Courgette', fallback: 'cursive' },
  { id: 'Yellowtail', name: 'Yellowtail', category: 'handwriting', googleFontName: 'Yellowtail', fallback: 'cursive' },
  { id: 'Bad Script', name: 'Bad Script', category: 'handwriting', googleFontName: 'Bad+Script', fallback: 'cursive' },
  { id: 'Marck Script', name: 'Marck Script', category: 'handwriting', googleFontName: 'Marck+Script', fallback: 'cursive' },
  { id: 'Permanent Marker', name: 'Permanent Marker', category: 'handwriting', googleFontName: 'Permanent+Marker', fallback: 'cursive' },
  { id: 'Rock Salt', name: 'Rock Salt', category: 'handwriting', googleFontName: 'Rock+Salt', fallback: 'cursive' },
  { id: 'Kalam', name: 'Kalam', category: 'handwriting', googleFontName: 'Kalam', fallback: 'cursive' },
  { id: 'Patrick Hand', name: 'Patrick Hand', category: 'handwriting', googleFontName: 'Patrick+Hand', fallback: 'cursive' },
  { id: 'Alex Brush', name: 'Alex Brush', category: 'handwriting', googleFontName: 'Alex+Brush', fallback: 'cursive' },
  { id: 'Parisienne', name: 'Parisienne', category: 'handwriting', googleFontName: 'Parisienne', fallback: 'cursive' },
  { id: 'Allura', name: 'Allura', category: 'handwriting', googleFontName: 'Allura', fallback: 'cursive' },
  { id: 'Tangerine', name: 'Tangerine', category: 'handwriting', googleFontName: 'Tangerine', fallback: 'cursive' },
  { id: 'Damion', name: 'Damion', category: 'handwriting', googleFontName: 'Damion', fallback: 'cursive' },
  { id: 'Reenie Beanie', name: 'Reenie Beanie', category: 'handwriting', googleFontName: 'Reenie+Beanie', fallback: 'cursive' },
  { id: 'Homemade Apple', name: 'Homemade Apple', category: 'handwriting', googleFontName: 'Homemade+Apple', fallback: 'cursive' },
  { id: 'Gochi Hand', name: 'Gochi Hand', category: 'handwriting', googleFontName: 'Gochi+Hand', fallback: 'cursive' },
  { id: 'Just Another Hand', name: 'Just Another Hand', category: 'handwriting', googleFontName: 'Just+Another+Hand', fallback: 'cursive' },
  { id: 'Covered By Your Grace', name: 'Covered By Your Grace', category: 'handwriting', googleFontName: 'Covered+By+Your+Grace', fallback: 'cursive' },
  { id: 'Playball', name: 'Playball', category: 'handwriting', googleFontName: 'Playball', fallback: 'cursive' },
  { id: 'Montez', name: 'Montez', category: 'handwriting', googleFontName: 'Montez', fallback: 'cursive' },
  { id: 'Pinyon Script', name: 'Pinyon Script', category: 'handwriting', googleFontName: 'Pinyon+Script', fallback: 'cursive' },
  { id: 'Rouge Script', name: 'Rouge Script', category: 'handwriting', googleFontName: 'Rouge+Script', fallback: 'cursive' },
  { id: 'Grand Hotel', name: 'Grand Hotel', category: 'handwriting', googleFontName: 'Grand+Hotel', fallback: 'cursive' },
  { id: 'Herr Von Muellerhoff', name: 'Herr Von Muellerhoff', category: 'handwriting', googleFontName: 'Herr+Von+Muellerhoff', fallback: 'cursive' },

  // ==========================================
  // 5. MONOSPACE & DAKTİLO / KOD (25 FONTS)
  // ==========================================
  { id: 'Courier New', name: 'Courier New', category: 'monospace', googleFontName: '', fallback: 'monospace' },
  { id: 'Roboto Mono', name: 'Roboto Mono', category: 'monospace', googleFontName: 'Roboto+Mono', fallback: 'monospace' },
  { id: 'Fira Code', name: 'Fira Code', category: 'monospace', googleFontName: 'Fira+Code', fallback: 'monospace' },
  { id: 'Source Code Pro', name: 'Source Code Pro', category: 'monospace', googleFontName: 'Source+Code+Pro', fallback: 'monospace' },
  { id: 'Space Mono', name: 'Space Mono', category: 'monospace', googleFontName: 'Space+Mono', fallback: 'monospace' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono', category: 'monospace', googleFontName: 'JetBrains+Mono', fallback: 'monospace' },
  { id: 'IBM Plex Mono', name: 'IBM Plex Mono', category: 'monospace', googleFontName: 'IBM+Plex+Mono', fallback: 'monospace' },
  { id: 'Inconsolata', name: 'Inconsolata', category: 'monospace', googleFontName: 'Inconsolata', fallback: 'monospace' },
  { id: 'Ubuntu Mono', name: 'Ubuntu Mono', category: 'monospace', googleFontName: 'Ubuntu+Mono', fallback: 'monospace' },
  { id: 'DM Mono', name: 'DM Mono', category: 'monospace', googleFontName: 'DM+Mono', fallback: 'monospace' },
  { id: 'Anonymous Pro', name: 'Anonymous Pro', category: 'monospace', googleFontName: 'Anonymous+Pro', fallback: 'monospace' },
  { id: 'VT323', name: 'VT323 (Retro Terminal)', category: 'monospace', googleFontName: 'VT323', fallback: 'monospace' },
  { id: 'Share Tech Mono', name: 'Share Tech Mono', category: 'monospace', googleFontName: 'Share+Tech+Mono', fallback: 'monospace' },
  { id: 'Major Mono Display', name: 'Major Mono Display', category: 'monospace', googleFontName: 'Major+Mono+Display', fallback: 'monospace' },
  { id: 'Nova Mono', name: 'Nova Mono', category: 'monospace', googleFontName: 'Nova+Mono', fallback: 'monospace' },
  { id: 'Cousine', name: 'Cousine', category: 'monospace', googleFontName: 'Cousine', fallback: 'monospace' },
  { id: 'Overpass Mono', name: 'Overpass Mono', category: 'monospace', googleFontName: 'Overpass+Mono', fallback: 'monospace' },
  { id: 'Spline Sans Mono', name: 'Spline Sans Mono', category: 'monospace', googleFontName: 'Spline+Sans+Mono', fallback: 'monospace' },
  { id: 'Red Hat Mono', name: 'Red Hat Mono', category: 'monospace', googleFontName: 'Red+Hat+Mono', fallback: 'monospace' },
  { id: 'Fragment Mono', name: 'Fragment Mono', category: 'monospace', googleFontName: 'Fragment+Mono', fallback: 'monospace' },
  { id: 'Syne Mono', name: 'Syne Mono', category: 'monospace', googleFontName: 'Syne+Mono', fallback: 'monospace' },
  { id: 'Martian Mono', name: 'Martian Mono', category: 'monospace', googleFontName: 'Martian+Mono', fallback: 'monospace' },
  { id: 'Azeret Mono', name: 'Azeret Mono', category: 'monospace', googleFontName: 'Azeret+Mono', fallback: 'monospace' },
  { id: 'B612 Mono', name: 'B612 Mono', category: 'monospace', googleFontName: 'B612+Mono', fallback: 'monospace' },
  { id: 'Fantasque Sans Mono', name: 'Fantasque Sans Mono', category: 'monospace', googleFontName: '', fallback: 'monospace' },

  // ==========================================
  // 6. FUTURISTIC & CYBERPUNK (25 FONTS)
  // ==========================================
  { id: 'Orbitron', name: 'Orbitron', category: 'futuristic', googleFontName: 'Orbitron', fallback: 'sans-serif' },
  { id: 'Chakra Petch', name: 'Chakra Petch', category: 'futuristic', googleFontName: 'Chakra+Petch', fallback: 'sans-serif' },
  { id: 'Exo', name: 'Exo', category: 'futuristic', googleFontName: 'Exo', fallback: 'sans-serif' },
  { id: 'Michroma', name: 'Michroma', category: 'futuristic', googleFontName: 'Michroma', fallback: 'sans-serif' },
  { id: 'Rajdhani', name: 'Rajdhani', category: 'futuristic', googleFontName: 'Rajdhani', fallback: 'sans-serif' },
  { id: 'Electrolize', name: 'Electrolize', category: 'futuristic', googleFontName: 'Electrolize', fallback: 'sans-serif' },
  { id: 'Syncopate', name: 'Syncopate', category: 'futuristic', googleFontName: 'Syncopate', fallback: 'sans-serif' },
  { id: 'Jura', name: 'Jura', category: 'futuristic', googleFontName: 'Jura', fallback: 'sans-serif' },
  { id: 'Bruno Ace', name: 'Bruno Ace', category: 'futuristic', googleFontName: 'Bruno+Ace', fallback: 'cursive' },
  { id: 'Oxanium', name: 'Oxanium', category: 'futuristic', googleFontName: 'Oxanium', fallback: 'cursive' },
  { id: 'Goldman', name: 'Goldman', category: 'futuristic', googleFontName: 'Goldman', fallback: 'cursive' },
  { id: 'Zen Dots', name: 'Zen Dots', category: 'futuristic', googleFontName: 'Zen+Dots', fallback: 'cursive' },
  { id: 'Press Start 2P', name: 'Press Start 2P (8-Bit)', category: 'futuristic', googleFontName: 'Press+Start+2P', fallback: 'cursive' },
  { id: 'Silkscreen', name: 'Silkscreen (Pixel)', category: 'futuristic', googleFontName: 'Silkscreen', fallback: 'cursive' },
  { id: 'Black Ops One', name: 'Black Ops One (Askeri)', category: 'futuristic', googleFontName: 'Black+Ops+One', fallback: 'cursive' },
  { id: 'Turret Road', name: 'Turret Road', category: 'futuristic', googleFontName: 'Turret+Road', fallback: 'sans-serif' },
  { id: 'Gruppo', name: 'Gruppo', category: 'futuristic', googleFontName: 'Gruppo', fallback: 'display' },
  { id: 'Quantico', name: 'Quantico', category: 'futuristic', googleFontName: 'Quantico', fallback: 'sans-serif' },
  { id: 'Ruda', name: 'Ruda', category: 'futuristic', googleFontName: 'Ruda', fallback: 'sans-serif' },
  { id: 'Wallpoet', name: 'Wallpoet', category: 'futuristic', googleFontName: 'Wallpoet', fallback: 'cursive' },
  { id: 'Geostar Fill', name: 'Geostar Fill', category: 'futuristic', googleFontName: 'Geostar+Fill', fallback: 'cursive' },
  { id: 'Nova Square', name: 'Nova Square', category: 'futuristic', googleFontName: 'Nova+Square', fallback: 'cursive' },
  { id: 'Saira Stencil One', name: 'Saira Stencil One', category: 'futuristic', googleFontName: 'Saira+Stencil+One', fallback: 'cursive' },
  { id: 'Allerta Stencil', name: 'Allerta Stencil', category: 'futuristic', googleFontName: 'Allerta+Stencil', fallback: 'sans-serif' },
  { id: 'Geo', name: 'Geo', category: 'futuristic', googleFontName: 'Geo', fallback: 'sans-serif' },
];

const loadedFonts = new Set<string>();

/**
 * Loads a Google Font dynamically into the browser document head
 * and registers it with document.fonts for instantaneous canvas rendering.
 */
export function loadGoogleFont(fontFamilyString: string): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(true);

  // Extract primary family name (e.g. "Montserrat" from "Montserrat, sans-serif")
  const primaryName = fontFamilyString.split(',')[0].replace(/['"]/g, '').trim();
  if (!primaryName || loadedFonts.has(primaryName)) return Promise.resolve(true);

  const matched = FONT_CATALOG.find(
    (f) => f.id.toLowerCase() === primaryName.toLowerCase() || f.name.toLowerCase() === primaryName.toLowerCase()
  );

  const googleName = matched?.googleFontName || primaryName.replace(/\s+/g, '+');
  if (!googleName) {
    loadedFonts.add(primaryName);
    return Promise.resolve(true);
  }

  loadedFonts.add(primaryName);

  return new Promise((resolve) => {
    const linkId = `gfont-${googleName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    if (document.getElementById(linkId)) {
      resolve(true);
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleName}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;

    link.onload = () => {
      if (document.fonts) {
        document.fonts.load(`16px "${primaryName}"`).then(() => resolve(true)).catch(() => resolve(true));
      } else {
        resolve(true);
      }
    };
    link.onerror = () => resolve(false);

    document.head.appendChild(link);

    // Timeout fallback so app never hangs
    setTimeout(() => resolve(true), 1200);
  });
}

/**
 * Preload the most popular top fonts on editor initialization
 */
export function preloadPopularFonts(): void {
  if (typeof document === 'undefined') return;
  const popular = [
    'Plus Jakarta Sans',
    'Inter',
    'Montserrat',
    'Poppins',
    'Roboto',
    'Playfair Display',
    'Cinzel',
    'Oswald',
    'Bebas Neue',
    'Anton',
    'Pacifico',
    'Caveat',
    'Dancing Script',
    'Permanent Marker',
    'Orbitron',
  ];
  for (const name of popular) {
    loadGoogleFont(name);
  }
}
