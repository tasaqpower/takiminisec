// FORMA Background Generator: Silk Ribbon Motion Sweep
(function() {
    var comp = app.project.items.addComp("Silk Ribbon Motion Sweep", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Silk Ribbon Motion Sweep Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();