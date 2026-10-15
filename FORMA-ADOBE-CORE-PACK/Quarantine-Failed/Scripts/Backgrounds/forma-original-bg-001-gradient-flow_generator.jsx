// FORMA Background Generator: Gradient Flow Horizon
(function() {
    var comp = app.project.items.addComp("Gradient Flow Horizon", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Gradient Flow Horizon Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();