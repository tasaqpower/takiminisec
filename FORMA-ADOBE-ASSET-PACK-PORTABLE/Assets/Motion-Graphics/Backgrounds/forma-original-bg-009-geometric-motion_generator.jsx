// FORMA Background Generator: Minimal Geometric Motion Grid
(function() {
    var comp = app.project.items.addComp("Minimal Geometric Motion Grid", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Minimal Geometric Motion Grid Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();