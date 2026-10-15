// FORMA Overlay Generator: ANAMORPHIC STREAK Procedural Overlay (Varyant 2)
(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Lütfen aktif bir kompozisyon açın.");
        return;
    }
    app.beginUndoGroup("FORMA Overlay");
    var solid = comp.layers.addSolid([1, 1, 1], "ANAMORPHIC STREAK Procedural Overlay (Varyant 2)", comp.width, comp.height, comp.pixelAspect);
    solid.blendingMode = BlendingMode.SCREEN;
    app.endUndoGroup();
})();