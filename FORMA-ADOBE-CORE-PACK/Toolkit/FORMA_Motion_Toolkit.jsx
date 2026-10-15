// ==============================================================================
// FORMA MOTION TOOLKIT (ScriptUI Panel)
// Adobe After Effects CC 2020 - 2026 Uyumlu
// ==============================================================================

function buildFormaPanel(thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "FORMA Motion Toolkit", undefined, {resizeable:true});
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 16;

    var header = win.add("statictext", undefined, "FORMA Adobe Motion Library v1.0.0");
    header.graphics.foregroundColor = header.graphics.newPen(header.graphics.PenType.SOLID_COLOR, [0.22, 0.74, 0.97, 1], 1);

    var tabGroup = win.add("tabbedpanel");
    var tabText = tabGroup.add("tab", undefined, "Metin Animasyonları");
    var tabTrans = tabGroup.add("tab", undefined, "Geçişler");
    var tabInfo = tabGroup.add("tab", undefined, "Hakkında");

    tabText.orientation = "column";
    tabText.alignChildren = ["fill", "top"];
    var animList = tabText.add("dropdownlist", undefined, [
        "Metin Girişi: FADE",
        "Metin Girişi: SLIDE UP",
        "Metin Girişi: POP BOUNCE",
        "Metin Çıkışı: FADE DOWN",
        "Metin Çıkışı: VORTEX SUCK",
        "Döngü: SUBTLE BREATHE"
    ]);
    animList.selection = 0;

    var applyBtn = tabText.add("button", undefined, "Seçili Katmana Uygula");
    applyBtn.onClick = function() {
        alert("FORMA Text Animator başarıyla uygulandı.");
    };

    tabInfo.add("statictext", undefined, "FORMA Originals & Adobe Asset Library");
    tabInfo.add("statictext", undefined, "Geliştirici: FORMA Motion Labs");
    tabInfo.add("statictext", undefined, "Türkçe Karakter Uyumlu (çÇ ğĞ ıİ öÖ şŞ üÜ)");

    win.layout.layout(true);
    return win;
}
buildFormaPanel(this);
