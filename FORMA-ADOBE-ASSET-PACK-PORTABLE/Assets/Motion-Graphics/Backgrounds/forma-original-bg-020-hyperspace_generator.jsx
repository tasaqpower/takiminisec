// FORMA Background Generator: Vortex Tunnel Hyperspace
(function() {
    var comp = app.project.items.addComp("Vortex Tunnel Hyperspace", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Vortex Tunnel Hyperspace Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();