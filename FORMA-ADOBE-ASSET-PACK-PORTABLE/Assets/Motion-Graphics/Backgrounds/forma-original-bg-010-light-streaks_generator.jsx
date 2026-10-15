// FORMA Background Generator: Anamorphic Light Streaks Glow
(function() {
    var comp = app.project.items.addComp("Anamorphic Light Streaks Glow", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Anamorphic Light Streaks Glow Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();