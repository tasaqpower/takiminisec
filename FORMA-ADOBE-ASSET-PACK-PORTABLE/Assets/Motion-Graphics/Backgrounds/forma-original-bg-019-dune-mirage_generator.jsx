// FORMA Background Generator: Desert Dune Mirage Ripple
(function() {
    var comp = app.project.items.addComp("Desert Dune Mirage Ripple", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Desert Dune Mirage Ripple Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();