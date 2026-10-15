// FORMA Background Generator: Golden Dust Ambient Rays
(function() {
    var comp = app.project.items.addComp("Golden Dust Ambient Rays", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Golden Dust Ambient Rays Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();