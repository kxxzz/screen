




void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec3 pos = vec3(-0.1, 0.2, -0.4);
    vec3 angles = vec3(.4, .35, 0);
    vec3 right, up, front;
    anglesToAxes(angles, right, up, front);

    Camera cam;
    cam.pos = pos;
    cam.target = pos + front;
    cam.up = up;
    cam.fov = HalfPI;

    float aspectRatio = iResolution.x / iResolution.y;
    vec3 rayOrigin, rayDir;
    cameraRayCalc(cam, fragCoord, aspectRatio, rayOrigin, rayDir);

    vec3 col = vec3(1);
    fragColor = vec4(col, 0.0);
}




































