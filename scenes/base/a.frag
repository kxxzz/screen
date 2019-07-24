
#define GI_BOUNDS 1


float sceneIntersect(in vec3 ro, in vec3 rd, out float dist, out vec3 norm, out vec3 diffuse)
{
    vec2 d; vec3 n0, n1;
    float hit = RayCubeIntersect(ro, rd, vec3(0.0, -0.8, 0.0), vec3(2., 0.05, 1.5), d);
    hit = hit > 0.0 ? 1.0 : 0.0;
    dist = d.x;
    norm = n0;
    diffuse = vec3(1.0, 0.005, 0.005) * 0.8;
    return hit;
}


vec3 pathTracing(in vec3 ro, in vec3 rd)
{
    vec3 col = vec3(0);
    for (float b = 0.0; b < float(GI_BOUNDS); ++b)
    {
        float dist;
        vec3 norm, diffuse;
        if (sceneIntersect(ro, rd, dist, norm, diffuse) > 0.0)
        {
            col = diffuse;
            break;
        }
        else
        {
            col = vec3(1);
            break;
        }
    }
    return col;
}




void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec3 pos = vec3(0.0, 0.0, -3.0);
    vec3 angles = vec3(0.0, 0.0, 0.0);
    vec3 right, up, front;
    anglesToAxes(angles, right, up, front);

    Camera cam;
    cam.pos = pos;
    cam.target = pos + front;
    cam.up = up;
    cam.fov = radians(25.);

    vec2 uv = fragCoord / iResolution.xy;
    float aspectRatio = iResolution.x / iResolution.y;
    vec3 rayOrigin, rayDir;
    cameraRayCalc(cam, uv, aspectRatio, rayOrigin, rayDir);
    //fragColor.rgb = rayDir;
    //return;

    vec3 col = pathTracing(rayOrigin, rayDir);

    //vec3 col = vec3(1);
    fragColor = vec4(col, 0.0);
}




































