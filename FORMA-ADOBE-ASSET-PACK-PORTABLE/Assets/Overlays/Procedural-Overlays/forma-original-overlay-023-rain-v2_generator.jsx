// FORMA Overlay Generator: RAIN Procedural Overlay (Varyant 2)
(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Lütfen aktif bir kompozisyon açın.");
        return;
    }
    app.beginUndoGroup("FORMA Overlay");
    var solid = comp.layers.addSolid([1, 1, 1], "RAIN Procedural Overlay (Varyant 2)", comp.width, comp.height, comp.pixelAspect);
    solid.blendingMode = BlendingMode.SCREEN;
    app.endUndoGroup();
})();