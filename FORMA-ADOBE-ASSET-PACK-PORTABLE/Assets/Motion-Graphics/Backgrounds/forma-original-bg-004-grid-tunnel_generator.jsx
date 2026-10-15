// FORMA Background Generator: Sci-Fi Grid Tunnel Infinite
(function() {
    var comp = app.project.items.addComp("Sci-Fi Grid Tunnel Infinite", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Sci-Fi Grid Tunnel Infinite Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();