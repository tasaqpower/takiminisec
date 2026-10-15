// FORMA Background Generator: Organic Ink Motion Diffusion
(function() {
    var comp = app.project.items.addComp("Organic Ink Motion Diffusion", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "Organic Ink Motion Diffusion Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();