/**
 * FORMA Video Editor — Curated Turkish-Compatible Typography Catalog
 * 160 high-quality Google Fonts rigorously verified for Turkish character set:
 * (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü)
 * Categorized into Sans Serif, Serif, Display, Monospace, and El Yazısı. Zero emojis.
 */

import { notifyCanvasNeedsRedraw } from './previewRenderer';

export type FontCategory = 'all' | 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting';

export interface FontItem {
  id: string; // Used in CSS / canvas font-family, e.g. "Montserrat"
  name: string; // User-facing label
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting';
  googleFontName: string; // For Google Fonts API URL
  fallback: string;
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'handwriting', label: 'El Yazısı' },
];

export const FONT_CATALOG: FontItem[] = [
  {
    "id": "ABeeZee",
    "name": "ABeeZee",
    "category": "sans-serif",
    "googleFontName": "ABeeZee",
    "fallback": "sans-serif"
  },
  {
    "id": "ADLaM Display",
    "name": "ADLaM Display",
    "category": "display",
    "googleFontName": "ADLaM+Display",
    "fallback": "sans-serif"
  },
  {
    "id": "AR One Sans",
    "name": "AR One Sans",
    "category": "sans-serif",
    "googleFontName": "AR+One+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Abhaya Libre",
    "name": "Abhaya Libre",
    "category": "serif",
    "googleFontName": "Abhaya+Libre",
    "fallback": "serif"
  },
  {
    "id": "Aboreto",
    "name": "Aboreto",
    "category": "display",
    "googleFontName": "Aboreto",
    "fallback": "sans-serif"
  },
  {
    "id": "Abril Fatface",
    "name": "Abril Fatface",
    "category": "display",
    "googleFontName": "Abril+Fatface",
    "fallback": "sans-serif"
  },
  {
    "id": "Abyssinica SIL",
    "name": "Abyssinica SIL",
    "category": "serif",
    "googleFontName": "Abyssinica+SIL",
    "fallback": "serif"
  },
  {
    "id": "Aclonica",
    "name": "Aclonica",
    "category": "sans-serif",
    "googleFontName": "Aclonica",
    "fallback": "sans-serif"
  },
  {
    "id": "Advent Pro",
    "name": "Advent Pro",
    "category": "sans-serif",
    "googleFontName": "Advent+Pro",
    "fallback": "sans-serif"
  },
  {
    "id": "Afacad",
    "name": "Afacad",
    "category": "sans-serif",
    "googleFontName": "Afacad",
    "fallback": "sans-serif"
  },
  {
    "id": "Afacad Flux",
    "name": "Afacad Flux",
    "category": "sans-serif",
    "googleFontName": "Afacad+Flux",
    "fallback": "sans-serif"
  },
  {
    "id": "Agbalumo",
    "name": "Agbalumo",
    "category": "display",
    "googleFontName": "Agbalumo",
    "fallback": "sans-serif"
  },
  {
    "id": "Agdasima",
    "name": "Agdasima",
    "category": "sans-serif",
    "googleFontName": "Agdasima",
    "fallback": "sans-serif"
  },
  {
    "id": "Agu Display",
    "name": "Agu Display",
    "category": "display",
    "googleFontName": "Agu+Display",
    "fallback": "sans-serif"
  },
  {
    "id": "Aguafina Script",
    "name": "Aguafina Script",
    "category": "handwriting",
    "googleFontName": "Aguafina+Script",
    "fallback": "cursive"
  },
  {
    "id": "Akatab",
    "name": "Akatab",
    "category": "sans-serif",
    "googleFontName": "Akatab",
    "fallback": "sans-serif"
  },
  {
    "id": "Akaya Kanadaka",
    "name": "Akaya Kanadaka",
    "category": "display",
    "googleFontName": "Akaya+Kanadaka",
    "fallback": "sans-serif"
  },
  {
    "id": "Akaya Telivigala",
    "name": "Akaya Telivigala",
    "category": "display",
    "googleFontName": "Akaya+Telivigala",
    "fallback": "sans-serif"
  },
  {
    "id": "Akronim",
    "name": "Akronim",
    "category": "display",
    "googleFontName": "Akronim",
    "fallback": "sans-serif"
  },
  {
    "id": "Akshar",
    "name": "Akshar",
    "category": "sans-serif",
    "googleFontName": "Akshar",
    "fallback": "sans-serif"
  },
  {
    "id": "Akt",
    "name": "Akt",
    "category": "sans-serif",
    "googleFontName": "Akt",
    "fallback": "sans-serif"
  },
  {
    "id": "Aladin",
    "name": "Aladin",
    "category": "display",
    "googleFontName": "Aladin",
    "fallback": "sans-serif"
  },
  {
    "id": "Alan Sans",
    "name": "Alan Sans",
    "category": "sans-serif",
    "googleFontName": "Alan+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Alata",
    "name": "Alata",
    "category": "sans-serif",
    "googleFontName": "Alata",
    "fallback": "sans-serif"
  },
  {
    "id": "Alatsi",
    "name": "Alatsi",
    "category": "sans-serif",
    "googleFontName": "Alatsi",
    "fallback": "sans-serif"
  },
  {
    "id": "Albert Sans",
    "name": "Albert Sans",
    "category": "sans-serif",
    "googleFontName": "Albert+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Alegreya",
    "name": "Alegreya",
    "category": "serif",
    "googleFontName": "Alegreya",
    "fallback": "serif"
  },
  {
    "id": "Alegreya SC",
    "name": "Alegreya SC",
    "category": "serif",
    "googleFontName": "Alegreya+SC",
    "fallback": "serif"
  },
  {
    "id": "Alegreya Sans",
    "name": "Alegreya Sans",
    "category": "sans-serif",
    "googleFontName": "Alegreya+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Alegreya Sans SC",
    "name": "Alegreya Sans SC",
    "category": "sans-serif",
    "googleFontName": "Alegreya+Sans+SC",
    "fallback": "sans-serif"
  },
  {
    "id": "Aleo",
    "name": "Aleo",
    "category": "serif",
    "googleFontName": "Aleo",
    "fallback": "serif"
  },
  {
    "id": "Alex Brush",
    "name": "Alex Brush",
    "category": "handwriting",
    "googleFontName": "Alex+Brush",
    "fallback": "cursive"
  },
  {
    "id": "Alexandria",
    "name": "Alexandria",
    "category": "sans-serif",
    "googleFontName": "Alexandria",
    "fallback": "sans-serif"
  },
  {
    "id": "Alfa Slab One",
    "name": "Alfa Slab One",
    "category": "display",
    "googleFontName": "Alfa+Slab+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Alice",
    "name": "Alice",
    "category": "serif",
    "googleFontName": "Alice",
    "fallback": "serif"
  },
  {
    "id": "Alien Block",
    "name": "Alien Block",
    "category": "display",
    "googleFontName": "Alien+Block",
    "fallback": "sans-serif"
  },
  {
    "id": "Alike",
    "name": "Alike",
    "category": "serif",
    "googleFontName": "Alike",
    "fallback": "serif"
  },
  {
    "id": "Alike Angular",
    "name": "Alike Angular",
    "category": "serif",
    "googleFontName": "Alike+Angular",
    "fallback": "serif"
  },
  {
    "id": "Alkalami",
    "name": "Alkalami",
    "category": "serif",
    "googleFontName": "Alkalami",
    "fallback": "serif"
  },
  {
    "id": "Alkatra",
    "name": "Alkatra",
    "category": "display",
    "googleFontName": "Alkatra",
    "fallback": "sans-serif"
  },
  {
    "id": "Allan",
    "name": "Allan",
    "category": "display",
    "googleFontName": "Allan",
    "fallback": "sans-serif"
  },
  {
    "id": "Allison",
    "name": "Allison",
    "category": "handwriting",
    "googleFontName": "Allison",
    "fallback": "cursive"
  },
  {
    "id": "Allura",
    "name": "Allura",
    "category": "handwriting",
    "googleFontName": "Allura",
    "fallback": "cursive"
  },
  {
    "id": "Almendra",
    "name": "Almendra",
    "category": "serif",
    "googleFontName": "Almendra",
    "fallback": "serif"
  },
  {
    "id": "Almendra Display",
    "name": "Almendra Display",
    "category": "display",
    "googleFontName": "Almendra+Display",
    "fallback": "sans-serif"
  },
  {
    "id": "Alumni Sans",
    "name": "Alumni Sans",
    "category": "sans-serif",
    "googleFontName": "Alumni+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Alumni Sans Collegiate One",
    "name": "Alumni Sans Collegiate One",
    "category": "sans-serif",
    "googleFontName": "Alumni+Sans+Collegiate+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Alumni Sans Inline One",
    "name": "Alumni Sans Inline One",
    "category": "display",
    "googleFontName": "Alumni+Sans+Inline+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Alumni Sans Pinstripe",
    "name": "Alumni Sans Pinstripe",
    "category": "sans-serif",
    "googleFontName": "Alumni+Sans+Pinstripe",
    "fallback": "sans-serif"
  },
  {
    "id": "Alumni Sans SC",
    "name": "Alumni Sans SC",
    "category": "sans-serif",
    "googleFontName": "Alumni+Sans+SC",
    "fallback": "sans-serif"
  },
  {
    "id": "Alyamama",
    "name": "Alyamama",
    "category": "serif",
    "googleFontName": "Alyamama",
    "fallback": "serif"
  },
  {
    "id": "Amarante",
    "name": "Amarante",
    "category": "display",
    "googleFontName": "Amarante",
    "fallback": "sans-serif"
  },
  {
    "id": "Amarna",
    "name": "Amarna",
    "category": "sans-serif",
    "googleFontName": "Amarna",
    "fallback": "sans-serif"
  },
  {
    "id": "Amatic SC",
    "name": "Amatic SC",
    "category": "handwriting",
    "googleFontName": "Amatic+SC",
    "fallback": "cursive"
  },
  {
    "id": "Amiko",
    "name": "Amiko",
    "category": "sans-serif",
    "googleFontName": "Amiko",
    "fallback": "sans-serif"
  },
  {
    "id": "Amiri",
    "name": "Amiri",
    "category": "serif",
    "googleFontName": "Amiri",
    "fallback": "serif"
  },
  {
    "id": "Amita",
    "name": "Amita",
    "category": "handwriting",
    "googleFontName": "Amita",
    "fallback": "cursive"
  },
  {
    "id": "Anaheim",
    "name": "Anaheim",
    "category": "sans-serif",
    "googleFontName": "Anaheim",
    "fallback": "sans-serif"
  },
  {
    "id": "Ancizar Sans",
    "name": "Ancizar Sans",
    "category": "sans-serif",
    "googleFontName": "Ancizar+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Ancizar Serif",
    "name": "Ancizar Serif",
    "category": "serif",
    "googleFontName": "Ancizar+Serif",
    "fallback": "serif"
  },
  {
    "id": "Andada Pro",
    "name": "Andada Pro",
    "category": "serif",
    "googleFontName": "Andada+Pro",
    "fallback": "serif"
  },
  {
    "id": "Andika",
    "name": "Andika",
    "category": "sans-serif",
    "googleFontName": "Andika",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Bangla",
    "name": "Anek Bangla",
    "category": "sans-serif",
    "googleFontName": "Anek+Bangla",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Devanagari",
    "name": "Anek Devanagari",
    "category": "sans-serif",
    "googleFontName": "Anek+Devanagari",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Gujarati",
    "name": "Anek Gujarati",
    "category": "sans-serif",
    "googleFontName": "Anek+Gujarati",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Gurmukhi",
    "name": "Anek Gurmukhi",
    "category": "sans-serif",
    "googleFontName": "Anek+Gurmukhi",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Kannada",
    "name": "Anek Kannada",
    "category": "sans-serif",
    "googleFontName": "Anek+Kannada",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Latin",
    "name": "Anek Latin",
    "category": "sans-serif",
    "googleFontName": "Anek+Latin",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Malayalam",
    "name": "Anek Malayalam",
    "category": "sans-serif",
    "googleFontName": "Anek+Malayalam",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Odia",
    "name": "Anek Odia",
    "category": "sans-serif",
    "googleFontName": "Anek+Odia",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Tamil",
    "name": "Anek Tamil",
    "category": "sans-serif",
    "googleFontName": "Anek+Tamil",
    "fallback": "sans-serif"
  },
  {
    "id": "Anek Telugu",
    "name": "Anek Telugu",
    "category": "sans-serif",
    "googleFontName": "Anek+Telugu",
    "fallback": "sans-serif"
  },
  {
    "id": "Annapurna SIL",
    "name": "Annapurna SIL",
    "category": "serif",
    "googleFontName": "Annapurna+SIL",
    "fallback": "serif"
  },
  {
    "id": "Annie Use Your Telescope",
    "name": "Annie Use Your Telescope",
    "category": "handwriting",
    "googleFontName": "Annie+Use+Your+Telescope",
    "fallback": "cursive"
  },
  {
    "id": "Anonymous Pro",
    "name": "Anonymous Pro",
    "category": "monospace",
    "googleFontName": "Anonymous+Pro",
    "fallback": "monospace"
  },
  {
    "id": "Anta",
    "name": "Anta",
    "category": "sans-serif",
    "googleFontName": "Anta",
    "fallback": "sans-serif"
  },
  {
    "id": "Anton",
    "name": "Anton",
    "category": "sans-serif",
    "googleFontName": "Anton",
    "fallback": "sans-serif"
  },
  {
    "id": "Anton SC",
    "name": "Anton SC",
    "category": "sans-serif",
    "googleFontName": "Anton+SC",
    "fallback": "sans-serif"
  },
  {
    "id": "Antonio",
    "name": "Antonio",
    "category": "sans-serif",
    "googleFontName": "Antonio",
    "fallback": "sans-serif"
  },
  {
    "id": "Anuphan",
    "name": "Anuphan",
    "category": "sans-serif",
    "googleFontName": "Anuphan",
    "fallback": "sans-serif"
  },
  {
    "id": "Anybody",
    "name": "Anybody",
    "category": "display",
    "googleFontName": "Anybody",
    "fallback": "sans-serif"
  },
  {
    "id": "Aoboshi One",
    "name": "Aoboshi One",
    "category": "serif",
    "googleFontName": "Aoboshi+One",
    "fallback": "serif"
  },
  {
    "id": "Arbutus",
    "name": "Arbutus",
    "category": "serif",
    "googleFontName": "Arbutus",
    "fallback": "serif"
  },
  {
    "id": "Arbutus Slab",
    "name": "Arbutus Slab",
    "category": "serif",
    "googleFontName": "Arbutus+Slab",
    "fallback": "serif"
  },
  {
    "id": "Architects Daughter",
    "name": "Architects Daughter",
    "category": "handwriting",
    "googleFontName": "Architects+Daughter",
    "fallback": "cursive"
  },
  {
    "id": "Archivo",
    "name": "Archivo",
    "category": "sans-serif",
    "googleFontName": "Archivo",
    "fallback": "sans-serif"
  },
  {
    "id": "Archivo Black",
    "name": "Archivo Black",
    "category": "sans-serif",
    "googleFontName": "Archivo+Black",
    "fallback": "sans-serif"
  },
  {
    "id": "Archivo Narrow",
    "name": "Archivo Narrow",
    "category": "sans-serif",
    "googleFontName": "Archivo+Narrow",
    "fallback": "sans-serif"
  },
  {
    "id": "Are You Serious",
    "name": "Are You Serious",
    "category": "handwriting",
    "googleFontName": "Are+You+Serious",
    "fallback": "cursive"
  },
  {
    "id": "Aref Ruqaa",
    "name": "Aref Ruqaa",
    "category": "serif",
    "googleFontName": "Aref+Ruqaa",
    "fallback": "serif"
  },
  {
    "id": "Aref Ruqaa Ink",
    "name": "Aref Ruqaa Ink",
    "category": "serif",
    "googleFontName": "Aref+Ruqaa+Ink",
    "fallback": "serif"
  },
  {
    "id": "Arima",
    "name": "Arima",
    "category": "display",
    "googleFontName": "Arima",
    "fallback": "sans-serif"
  },
  {
    "id": "Arimo",
    "name": "Arimo",
    "category": "sans-serif",
    "googleFontName": "Arimo",
    "fallback": "sans-serif"
  },
  {
    "id": "Arizonia",
    "name": "Arizonia",
    "category": "handwriting",
    "googleFontName": "Arizonia",
    "fallback": "cursive"
  },
  {
    "id": "Armata",
    "name": "Armata",
    "category": "sans-serif",
    "googleFontName": "Armata",
    "fallback": "sans-serif"
  },
  {
    "id": "Arsenal",
    "name": "Arsenal",
    "category": "sans-serif",
    "googleFontName": "Arsenal",
    "fallback": "sans-serif"
  },
  {
    "id": "Arsenal SC",
    "name": "Arsenal SC",
    "category": "sans-serif",
    "googleFontName": "Arsenal+SC",
    "fallback": "sans-serif"
  },
  {
    "id": "Arya",
    "name": "Arya",
    "category": "sans-serif",
    "googleFontName": "Arya",
    "fallback": "sans-serif"
  },
  {
    "id": "Asap",
    "name": "Asap",
    "category": "sans-serif",
    "googleFontName": "Asap",
    "fallback": "sans-serif"
  },
  {
    "id": "Asap Condensed",
    "name": "Asap Condensed",
    "category": "sans-serif",
    "googleFontName": "Asap+Condensed",
    "fallback": "sans-serif"
  },
  {
    "id": "Asap Sharp",
    "name": "Asap Sharp",
    "category": "sans-serif",
    "googleFontName": "Asap+Sharp",
    "fallback": "sans-serif"
  },
  {
    "id": "Asar",
    "name": "Asar",
    "category": "serif",
    "googleFontName": "Asar",
    "fallback": "serif"
  },
  {
    "id": "Asimovian",
    "name": "Asimovian",
    "category": "sans-serif",
    "googleFontName": "Asimovian",
    "fallback": "sans-serif"
  },
  {
    "id": "Asset",
    "name": "Asset",
    "category": "display",
    "googleFontName": "Asset",
    "fallback": "sans-serif"
  },
  {
    "id": "Assistant",
    "name": "Assistant",
    "category": "sans-serif",
    "googleFontName": "Assistant",
    "fallback": "sans-serif"
  },
  {
    "id": "Athiti",
    "name": "Athiti",
    "category": "sans-serif",
    "googleFontName": "Athiti",
    "fallback": "sans-serif"
  },
  {
    "id": "Atkinson Hyperlegible",
    "name": "Atkinson Hyperlegible",
    "category": "sans-serif",
    "googleFontName": "Atkinson+Hyperlegible",
    "fallback": "sans-serif"
  },
  {
    "id": "Atkinson Hyperlegible Mono",
    "name": "Atkinson Hyperlegible Mono",
    "category": "sans-serif",
    "googleFontName": "Atkinson+Hyperlegible+Mono",
    "fallback": "sans-serif"
  },
  {
    "id": "Atkinson Hyperlegible Next",
    "name": "Atkinson Hyperlegible Next",
    "category": "sans-serif",
    "googleFontName": "Atkinson+Hyperlegible+Next",
    "fallback": "sans-serif"
  },
  {
    "id": "Atma",
    "name": "Atma",
    "category": "display",
    "googleFontName": "Atma",
    "fallback": "sans-serif"
  },
  {
    "id": "Atomic Age",
    "name": "Atomic Age",
    "category": "display",
    "googleFontName": "Atomic+Age",
    "fallback": "sans-serif"
  },
  {
    "id": "Audiowide",
    "name": "Audiowide",
    "category": "display",
    "googleFontName": "Audiowide",
    "fallback": "sans-serif"
  },
  {
    "id": "Autour One",
    "name": "Autour One",
    "category": "display",
    "googleFontName": "Autour+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Average",
    "name": "Average",
    "category": "serif",
    "googleFontName": "Average",
    "fallback": "serif"
  },
  {
    "id": "Average Sans",
    "name": "Average Sans",
    "category": "sans-serif",
    "googleFontName": "Average+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Averia Gruesa Libre",
    "name": "Averia Gruesa Libre",
    "category": "display",
    "googleFontName": "Averia+Gruesa+Libre",
    "fallback": "sans-serif"
  },
  {
    "id": "Azeret Mono",
    "name": "Azeret Mono",
    "category": "monospace",
    "googleFontName": "Azeret+Mono",
    "fallback": "monospace"
  },
  {
    "id": "BIZ UDGothic",
    "name": "BIZ UDGothic",
    "category": "sans-serif",
    "googleFontName": "BIZ+UDGothic",
    "fallback": "sans-serif"
  },
  {
    "id": "BIZ UDMincho",
    "name": "BIZ UDMincho",
    "category": "serif",
    "googleFontName": "BIZ+UDMincho",
    "fallback": "serif"
  },
  {
    "id": "BIZ UDPGothic",
    "name": "BIZ UDPGothic",
    "category": "sans-serif",
    "googleFontName": "BIZ+UDPGothic",
    "fallback": "sans-serif"
  },
  {
    "id": "BIZ UDPMincho",
    "name": "BIZ UDPMincho",
    "category": "serif",
    "googleFontName": "BIZ+UDPMincho",
    "fallback": "serif"
  },
  {
    "id": "Babylonica",
    "name": "Babylonica",
    "category": "handwriting",
    "googleFontName": "Babylonica",
    "fallback": "cursive"
  },
  {
    "id": "Bacasime Antique",
    "name": "Bacasime Antique",
    "category": "serif",
    "googleFontName": "Bacasime+Antique",
    "fallback": "serif"
  },
  {
    "id": "Bad Script",
    "name": "Bad Script",
    "category": "handwriting",
    "googleFontName": "Bad+Script",
    "fallback": "cursive"
  },
  {
    "id": "Badeen Display",
    "name": "Badeen Display",
    "category": "display",
    "googleFontName": "Badeen+Display",
    "fallback": "sans-serif"
  },
  {
    "id": "Bagel Fat One",
    "name": "Bagel Fat One",
    "category": "display",
    "googleFontName": "Bagel+Fat+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Bahiana",
    "name": "Bahiana",
    "category": "display",
    "googleFontName": "Bahiana",
    "fallback": "sans-serif"
  },
  {
    "id": "Bahianita",
    "name": "Bahianita",
    "category": "display",
    "googleFontName": "Bahianita",
    "fallback": "sans-serif"
  },
  {
    "id": "Bai Jamjuree",
    "name": "Bai Jamjuree",
    "category": "sans-serif",
    "googleFontName": "Bai+Jamjuree",
    "fallback": "sans-serif"
  },
  {
    "id": "Bakbak One",
    "name": "Bakbak One",
    "category": "display",
    "googleFontName": "Bakbak+One",
    "fallback": "sans-serif"
  },
  {
    "id": "Ballet",
    "name": "Ballet",
    "category": "handwriting",
    "googleFontName": "Ballet",
    "fallback": "cursive"
  },
  {
    "id": "Baloo 2",
    "name": "Baloo 2",
    "category": "display",
    "googleFontName": "Baloo+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Bhai 2",
    "name": "Baloo Bhai 2",
    "category": "display",
    "googleFontName": "Baloo+Bhai+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Bhaijaan 2",
    "name": "Baloo Bhaijaan 2",
    "category": "display",
    "googleFontName": "Baloo+Bhaijaan+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Bhaina 2",
    "name": "Baloo Bhaina 2",
    "category": "display",
    "googleFontName": "Baloo+Bhaina+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Chettan 2",
    "name": "Baloo Chettan 2",
    "category": "display",
    "googleFontName": "Baloo+Chettan+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Da 2",
    "name": "Baloo Da 2",
    "category": "display",
    "googleFontName": "Baloo+Da+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Paaji 2",
    "name": "Baloo Paaji 2",
    "category": "display",
    "googleFontName": "Baloo+Paaji+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Tamma 2",
    "name": "Baloo Tamma 2",
    "category": "display",
    "googleFontName": "Baloo+Tamma+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Tammudu 2",
    "name": "Baloo Tammudu 2",
    "category": "display",
    "googleFontName": "Baloo+Tammudu+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Baloo Thambi 2",
    "name": "Baloo Thambi 2",
    "category": "display",
    "googleFontName": "Baloo+Thambi+2",
    "fallback": "sans-serif"
  },
  {
    "id": "Balsamiq Sans",
    "name": "Balsamiq Sans",
    "category": "display",
    "googleFontName": "Balsamiq+Sans",
    "fallback": "sans-serif"
  },
  {
    "id": "Bangers",
    "name": "Bangers",
    "category": "display",
    "googleFontName": "Bangers",
    "fallback": "sans-serif"
  },
  {
    "id": "Barlow",
    "name": "Barlow",
    "category": "sans-serif",
    "googleFontName": "Barlow",
    "fallback": "sans-serif"
  },
  {
    "id": "Barlow Condensed",
    "name": "Barlow Condensed",
    "category": "sans-serif",
    "googleFontName": "Barlow+Condensed",
    "fallback": "sans-serif"
  },
  {
    "id": "Barlow Semi Condensed",
    "name": "Barlow Semi Condensed",
    "category": "sans-serif",
    "googleFontName": "Barlow+Semi+Condensed",
    "fallback": "sans-serif"
  },
  {
    "id": "Barriecito",
    "name": "Barriecito",
    "category": "display",
    "googleFontName": "Barriecito",
    "fallback": "sans-serif"
  },
  {
    "id": "Barrio",
    "name": "Barrio",
    "category": "display",
    "googleFontName": "Barrio",
    "fallback": "sans-serif"
  },
  {
    "id": "Basic",
    "name": "Basic",
    "category": "sans-serif",
    "googleFontName": "Basic",
    "fallback": "sans-serif"
  },
  {
    "id": "Baskervville",
    "name": "Baskervville",
    "category": "serif",
    "googleFontName": "Baskervville",
    "fallback": "serif"
  },
  {
    "id": "Baskervville SC",
    "name": "Baskervville SC",
    "category": "serif",
    "googleFontName": "Baskervville+SC",
    "fallback": "serif"
  },
  {
    "id": "Be Vietnam Pro",
    "name": "Be Vietnam Pro",
    "category": "sans-serif",
    "googleFontName": "Be+Vietnam+Pro",
    "fallback": "sans-serif"
  },
  {
    "id": "Beau Rivage",
    "name": "Beau Rivage",
    "category": "handwriting",
    "googleFontName": "Beau+Rivage",
    "fallback": "cursive"
  },
  {
    "id": "Bebas Neue",
    "name": "Bebas Neue",
    "category": "sans-serif",
    "googleFontName": "Bebas+Neue",
    "fallback": "sans-serif"
  },
  {
    "id": "Beiruti",
    "name": "Beiruti",
    "category": "sans-serif",
    "googleFontName": "Beiruti",
    "fallback": "sans-serif"
  },
  {
    "id": "Belanosima",
    "name": "Belanosima",
    "category": "sans-serif",
    "googleFontName": "Belanosima",
    "fallback": "sans-serif"
  },
  {
    "id": "Bellefair",
    "name": "Bellefair",
    "category": "serif",
    "googleFontName": "Bellefair",
    "fallback": "serif"
  },
  {
    "id": "Belleza",
    "name": "Belleza",
    "category": "sans-serif",
    "googleFontName": "Belleza",
    "fallback": "sans-serif"
  },
  {
    "id": "Bellota",
    "name": "Bellota",
    "category": "display",
    "googleFontName": "Bellota",
    "fallback": "sans-serif"
  },
  {
    "id": "Bellota Text",
    "name": "Bellota Text",
    "category": "display",
    "googleFontName": "Bellota+Text",
    "fallback": "sans-serif"
  }
];

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();
const loadedCategoryBatches = new Set<string>();

/**
 * Normalizes font name by stripping 'font-', ' Font', ' Yazı Tipi', quotes etc.
 */
export function normalizeFontName(rawName: string): string {
  if (!rawName) return 'Plus Jakarta Sans';
  let cleaned = rawName.replace(/^font-/i, '').replace(/['"]/g, '').trim();
  cleaned = cleaned.replace(/\s+Font$/i, '').replace(/\s+Yazı Tipi$/i, '').trim();
  const matched = FONT_CATALOG.find((f) => f.id.toLowerCase() === cleaned.toLowerCase() || f.name.toLowerCase() === cleaned.toLowerCase());
  return matched ? matched.id : cleaned;
}

/**
 * Dynamically injects Google Fonts link stylesheet and awaits FontFace document load.
 * Works for any Google font without hardcoded whitelist and without forcing unsupported axis ranges.
 */
export async function loadGoogleFont(fontId: string): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!fontId) return;

  const resolvedFamily = normalizeFontName(fontId);
  if (loadedFonts.has(resolvedFamily)) return;
  if (loadingPromises.has(resolvedFamily)) return loadingPromises.get(resolvedFamily);

  const promise = (async () => {
    try {
      const safeId = resolvedFamily.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const linkId = `gfont-${safeId}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        const encodedFamily = encodeURIComponent(resolvedFamily).replace(/%20/g, '+');
        link.href = `https://fonts.googleapis.com/css2?family=${encodedFamily}&display=swap`;
        document.head.appendChild(link);
      }

      if ('fonts' in document) {
        try {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
          await Promise.race([
            (document as any).fonts.load(`16px "${resolvedFamily}"`),
            timeout
          ]);
        } catch {
          // Continue if timeout or fonts.load unsupported
        }
      }

      loadedFonts.add(resolvedFamily);
      notifyCanvasNeedsRedraw();
    } catch (err) {
      console.warn(`[fontCatalog] Font load failed for "${resolvedFamily}":`, err);
      loadedFonts.add(resolvedFamily);
    } finally {
      loadingPromises.delete(resolvedFamily);
    }
  })();

  loadingPromises.set(resolvedFamily, promise);
  return promise;
}

export function isFontLoaded(fontId: string): boolean {
  const resolved = normalizeFontName(fontId);
  return loadedFonts.has(resolved);
}

export function prefetchCategoryFonts(category: FontCategory): void {
  if (typeof document === 'undefined') return;
  if (loadedCategoryBatches.has(category)) return;
  loadedCategoryBatches.add(category);

  const fonts = category === 'all'
    ? FONT_CATALOG
    : FONT_CATALOG.filter((f) => f.category === category);

  // Split into chunks of 15 to stay within safe URL length limits
  const CHUNK_SIZE = 15;
  for (let i = 0; i < fonts.length; i += CHUNK_SIZE) {
    const chunk = fonts.slice(i, i + CHUNK_SIZE);
    const families = chunk.map((f) => `family=${encodeURIComponent(f.id).replace(/%20/g, '+')}&display=swap`).join('&');
    const linkId = `gfont-batch-${category}-${i}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}`;
      document.head.appendChild(link);
    }
  }
}

export function preloadPopularFonts(): void {
  if (typeof document === 'undefined') return;
  const popular = ['Inter', 'Plus Jakarta Sans', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono', 'Caveat', 'Oswald'];
  for (const name of popular) {
    loadGoogleFont(name).catch(() => {});
  }
}
