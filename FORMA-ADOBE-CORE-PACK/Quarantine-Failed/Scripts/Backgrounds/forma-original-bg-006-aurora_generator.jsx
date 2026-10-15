// FORMA Background Generator: Polar Aurora Borealis Shimmer
(function() {
    var comp = app.project.items.addComp("Polar Aurora Borealis Shimmer", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Polar Aurora Borealis Shimmer Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();