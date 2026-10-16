import React, { useMemo, useEffect } from 'react';
import { CatalogAssetItem } from '../../engine/assetCatalog';
import { TextLayerData } from '../../types';
import { loadGoogleFont } from '../../engine/fontCatalog';
import { Sparkles } from 'lucide-react';

export function createTitleClipTextData(asset: CatalogAssetItem): Partial<TextLayerData> {
  if (asset.metadata && (asset.metadata as any).textData) {
    const td = (asset.metadata as any).textData;
    if (td.fontFamily) {
      loadGoogleFont(td.fontFamily).catch(() => {});
    }
    return {
      text: td.text || asset.localizedName,
      ...td,
    };
  }

  if (asset.type === 'font' || asset.category === 'Türkçe Uyumlu Fontlar') {
    const family = (asset.fontFamily || asset.name.replace(/\s+Font$/i, '')).trim();
    loadGoogleFont(family).catch(() => {});
    return {
      text: `${family} Başlık`,
      fontSize: 54,
      fontWeight: 'bold',
      color: '#ffffff',
      fillColor: '#ffffff',
      fontFamily: family,
      textAlign: 'center',
      alignment: 'center',
    };
  }

  const baseText = asset.defaultText || asset.localizedName || 'Forma Başlık';
  const style = asset.style || (asset.metadata as any)?.style || 'modern';

  let res: Partial<TextLayerData> = {
    text: baseText,
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 54,
    fontWeight: 'bold',
    color: '#ffffff',
    fillColor: '#ffffff',
    textAlign: 'center',
    alignment: 'center',
  };

  switch (style) {
    case 'lower-third':
    case 'lowerthird':
      res = {
        text: baseText,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 44,
        fontWeight: '600',
        color: '#ffffff',
        fillColor: '#ffffff',
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backgroundOpacity: 0.88,
        paddingX: 24,
        paddingY: 12,
        borderRadius: 6,
        textAlign: 'left',
        alignment: 'left',
      };
      break;
    case 'cinematic':
      loadGoogleFont('Playfair Display').catch(() => {});
      res = {
        text: baseText,
        fontFamily: 'Playfair Display',
        fontSize: 56,
        fontWeight: '700',
        color: '#fbbf24',
        fillColor: '#fbbf24',
        strokeColor: '#78350f',
        strokeWidth: 1.5,
        shadowColor: 'rgba(245, 158, 11, 0.4)',
        shadowBlur: 14,
        letterSpacing: 2,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'news':
      loadGoogleFont('Oswald').catch(() => {});
      res = {
        text: baseText,
        fontFamily: 'Oswald',
        fontSize: 44,
        fontWeight: 'bold',
        color: '#ffffff',
        fillColor: '#ffffff',
        backgroundColor: '#dc2626',
        backgroundOpacity: 0.95,
        paddingX: 28,
        paddingY: 14,
        letterSpacing: 1,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'social':
      loadGoogleFont('Montserrat').catch(() => {});
      res = {
        text: baseText,
        fontFamily: 'Montserrat',
        fontSize: 56,
        fontWeight: '900',
        color: '#a3e635',
        fillColor: '#a3e635',
        strokeColor: '#000000',
        strokeWidth: 5,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 8,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'promo':
      loadGoogleFont('Anton').catch(() => {});
      res = {
        text: baseText,
        fontFamily: 'Anton',
        fontSize: 56,
        fontWeight: '900',
        color: '#ffffff',
        fillColor: '#ffffff',
        backgroundColor: '#dc2626',
        backgroundOpacity: 0.9,
        paddingX: 30,
        paddingY: 14,
        borderRadius: 4,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'minimal':
      res = {
        text: baseText,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 48,
        fontWeight: '500',
        color: '#ffffff',
        fillColor: '#ffffff',
        shadowBlur: 6,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'subtitle':
      res = {
        text: baseText,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 50,
        fontWeight: '800',
        color: '#facc15',
        fillColor: '#facc15',
        strokeColor: '#000000',
        strokeWidth: 5,
        shadowBlur: 6,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'neon':
      res = {
        text: baseText,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 54,
        fontWeight: '800',
        color: '#f43f5e',
        fillColor: '#f43f5e',
        strokeColor: '#fda4af',
        strokeWidth: 2,
        shadowColor: '#ec4899',
        shadowBlur: 20,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
    case 'tech':
      loadGoogleFont('JetBrains Mono').catch(() => {});
      res = {
        text: baseText,
        fontFamily: 'JetBrains Mono',
        fontSize: 42,
        fontWeight: '700',
        color: '#38bdf8',
        fillColor: '#38bdf8',
        backgroundColor: 'rgba(12, 74, 110, 0.7)',
        backgroundOpacity: 0.7,
        paddingX: 20,
        paddingY: 10,
        borderRadius: 4,
        textAlign: 'center',
        alignment: 'center',
      };
      break;
  }

  // Animation metadata if present
  if (asset.category === 'Metin Animasyonları' || asset.tags?.includes('text-animation')) {
    const animKind = (asset.metadata as any)?.animKind || 'in';
    const technicalId = (asset.metadata as any)?.technicalId || asset.id.replace(/^forma-original-textanim-\d+-/, '').replace(/^anim-/, '');
    if (animKind === 'in' || technicalId.startsWith('in-') || technicalId === 'typewriter') {
      res.inAnimation = technicalId.replace(/^in-/, '') as any;
      res.inDuration = asset.duration || 0.8;
    } else if (animKind === 'loop' || technicalId.startsWith('loop-')) {
      res.loopAnimation = technicalId.replace(/^loop-/, '') as any;
    } else if (animKind === 'out' || technicalId.startsWith('out-')) {
      res.outAnimation = technicalId.replace(/^out-/, '') as any;
      res.outDuration = asset.duration || 0.6;
    }
  }

  return res;
}

export const FontAssetPreview: React.FC<{ asset: CatalogAssetItem }> = ({ asset }) => {
  const family = (asset.fontFamily || asset.name.replace(/\s+Font$/i, '')).trim();

  useEffect(() => {
    loadGoogleFont(family).catch(() => {});
  }, [family]);

  return (
    <div
      onMouseEnter={() => {
        loadGoogleFont(family).catch(() => {});
      }}
      className="relative w-full h-16 rounded-[2px] overflow-hidden bg-[#0A0D12] border border-[#232936] my-1 p-1.5 flex flex-col justify-between group-hover:border-[#4f6bf5]/50 transition-colors select-none"
    >
      <div className="flex items-center justify-between text-[8px] text-gray-400">
        <span className="font-mono text-teal-400 truncate max-w-[80px]">{family}</span>
        <span className="px-1 py-0.2 bg-[#161a22] rounded border border-[#202531] text-[7.5px] text-gray-400">
          {asset.fontCategory || 'Font'}
        </span>
      </div>
      <div
        className="text-[14px] font-semibold text-white truncate text-center leading-tight tracking-wide"
        style={{ fontFamily: `"${family}", sans-serif` }}
        title="Türkçe Karakterler: ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü"
      >
        Aa Şş Ğğ 123
      </div>
      <div className="text-[7.5px] text-emerald-400/90 text-center truncate flex items-center justify-center gap-0.5">
        <span>✓</span>
        <span>Türkçe Uyumlu Tipografi</span>
      </div>
    </div>
  );
};

export const TitleAssetPreview: React.FC<{ asset: CatalogAssetItem }> = ({ asset }) => {
  const textData = useMemo(() => createTitleClipTextData(asset), [asset]);
  const styleKind = asset.style || (asset.metadata as any)?.style || 'title';
  const isAnim = asset.category?.includes('Animasyon') || asset.tags?.includes('text-animation');
  const animLabel = textData.inAnimation || (asset.metadata as any)?.textData?.inAnimation;

  useEffect(() => {
    if (textData.fontFamily) {
      loadGoogleFont(textData.fontFamily).catch(() => {});
    }
  }, [textData.fontFamily]);

  const lines = (textData.text || asset.localizedName || 'Forma Başlık').split('\n');
  const primaryLine = lines[0];
  const secondaryLine = lines.length > 1 ? lines[1] : null;

  return (
    <div
      onMouseEnter={() => {
        if (textData.fontFamily) loadGoogleFont(textData.fontFamily).catch(() => {});
      }}
      className="relative w-full h-[72px] rounded-[3px] overflow-hidden bg-[#0A0D12] border border-[#232936] my-1 p-1.5 flex flex-col justify-between group-hover:border-[#4f6bf5]/60 transition-colors select-none"
    >
      {/* Top Header: Font Family & Style/Anim Pill */}
      <div className="flex items-center justify-between text-[7.5px] text-gray-400 pointer-events-none">
        <span className="font-mono text-sky-400 font-semibold truncate max-w-[85px]">
          {textData.fontFamily || 'Sans'}
        </span>
        <span className="px-1 py-0.2 bg-[#161a22] rounded border border-[#202531] text-[7px] text-gray-300">
          {animLabel ? `✦ ${animLabel}` : styleKind}
        </span>
      </div>

      {/* Main Visual Title Preview */}
      <div className="flex-1 flex items-center justify-center w-full px-0.5 overflow-hidden">
        {isAnim ? (
          <div className="flex items-center gap-1 text-center px-1">
            <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
            <span
              className="text-[9.5px] font-semibold text-purple-200 truncate block"
              style={{ fontFamily: textData.fontFamily ? `"${textData.fontFamily}", sans-serif` : 'inherit' }}
            >
              {primaryLine}
            </span>
          </div>
        ) : (
          <div
            className="max-w-full px-1.5 py-0.5 rounded transition-transform"
            style={{
              backgroundColor: textData.backgroundColor || 'transparent',
              borderRadius: textData.borderRadius ? Math.min(textData.borderRadius, 6) : 2,
              textAlign: (textData.textAlign as any) || 'center',
              boxShadow: textData.shadowColor ? `0 1px 4px ${textData.shadowColor}` : undefined,
            }}
          >
            <div
              className="text-[10px] font-bold leading-tight truncate tracking-wide"
              style={{
                fontFamily: textData.fontFamily ? `"${textData.fontFamily}", sans-serif` : 'inherit',
                color: textData.color || '#ffffff',
                WebkitTextStroke:
                  textData.strokeColor && (textData.strokeWidth || 0) > 0 ? `0.35px ${textData.strokeColor}` : undefined,
                letterSpacing: textData.letterSpacing ? `${Math.min(textData.letterSpacing * 0.3, 2)}px` : undefined,
                textTransform: (textData as any).textTransform || 'none',
              }}
            >
              {primaryLine}
            </div>
            {secondaryLine && (
              <div
                className="text-[7.5px] font-medium leading-tight truncate opacity-85 mt-0.5"
                style={{
                  fontFamily: textData.fontFamily ? `"${textData.fontFamily}", sans-serif` : 'inherit',
                  color: textData.color || '#cbd5e1',
                }}
              >
                {secondaryLine}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer: Badge indicator */}
      <div className="flex items-center justify-between text-[7px] text-gray-400 pointer-events-none">
        <span className="text-gray-400 truncate max-w-[95px]">{asset.localizedName}</span>
        <span className="text-emerald-400 font-mono">Türkçe ✓</span>
      </div>
    </div>
  );
};
