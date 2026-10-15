// ==============================================================================
// FORMA Text Animation Preset: Metin Çıkışı: KINETIC RECOIL OUT
// Hedef: Adobe After Effects (2020 - 2026) ExtendScript
// animKind: out | technicalId: out-kinetic-recoil-out
// Lisans: FORMA-ORIGINAL-1.0
// ==============================================================================

(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("FORMA Hatası: Lütfen aktif bir After Effects kompozisyonu açın.");
        return;
    }
    var layer = comp.selectedLayers[0];
    if (!layer || !(layer instanceof TextLayer)) {
        alert("FORMA Hatası: Lütfen animasyon uygulanacak bir Metin (Text) katmanı seçin.");
        return;
    }

    app.beginUndoGroup("FORMA: " + "Metin Çıkışı: KINETIC RECOIL OUT");

    try {
        var animators = layer.text.animators;
        var anim = animators.addProperty("ADBE Text Animator");
        anim.name = "FORMA [out-kinetic-recoil-out]";

        var props = anim.property("ADBE Text Animator Properties");
        var selector = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        var startProp = selector.property("ADBE Text Percent Start");
        var endProp = selector.property("ADBE Text Percent End");
        var offsetProp = selector.property("ADBE Text Percent Offset");

        var curTime = comp.time;
        var dur = 0.6;

        if ("out" === "in") {
            var opacity = props.addProperty("ADBE Text Opacity");
            opacity.setValue(0);
            var pos = props.addProperty("ADBE Text Position 3D");
            pos.setValue([0, 50 * 1, 0]);

            startProp.setValueAtTime(curTime, 0);
            startProp.setValueAtTime(curTime + dur, 100);
        } else if ("out" === "out") {
            var opacity = props.addProperty("ADBE Text Opacity");
            opacity.setValue(0);
            var scale = props.addProperty("ADBE Text Scale 3D");
            scale.setValue([120, 120, 100]);

            endProp.setValueAtTime(curTime, 100);
            endProp.setValueAtTime(curTime + dur, 0);
        } else {
            var pos = props.addProperty("ADBE Text Position 3D");
            pos.setValue([0, -15 * 1, 0]);
            offsetProp.setValueAtTime(curTime, -100);
            offsetProp.setValueAtTime(curTime + dur, 100);
        }

    } catch (err) {
        alert("Animasyon uygulanırken hata oluştu: " + err.toString());
    } finally {
        app.endUndoGroup();
    }
})();
