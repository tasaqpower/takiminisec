// FORMA Overlay Generator: SMOKE Procedural Overlay (Varyant 1)
(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Lütfen aktif bir kompozisyon açın.");
        return;
    }
    app.beginUndoGroup("FORMA Overlay");
    var solid = comp.layers.addSolid([1, 1, 1], "SMOKE Procedural Overlay (Varyant 1)", comp.width, comp.height, comp.pixelAspect);
    solid.blendingMode = BlendingMode.SCREEN;
    app.endUndoGroup();
})();