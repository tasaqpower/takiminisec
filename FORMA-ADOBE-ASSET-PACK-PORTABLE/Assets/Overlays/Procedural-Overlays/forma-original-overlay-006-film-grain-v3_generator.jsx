// FORMA Overlay Generator: FILM GRAIN Procedural Overlay (Varyant 3)
(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Lütfen aktif bir kompozisyon açın.");
        return;
    }
    app.beginUndoGroup("FORMA Overlay");
    var solid = comp.layers.addSolid([1, 1, 1], "FILM GRAIN Procedural Overlay (Varyant 3)", comp.width, comp.height, comp.pixelAspect);
    solid.blendingMode = BlendingMode.SCREEN;
    app.endUndoGroup();
})();