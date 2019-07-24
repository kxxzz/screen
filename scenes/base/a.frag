
#define GI_BOUNDS 1



float sceneIntersect(in vec3 ro, in vec3 rd, out float dist, out vec3 norm, out Material mtl)
{
    float hit;
    {
        vec2 d; vec3 n0, n1;
        float hit0 = RayCubeIntersect(ro, rd, vec3(0.0, -0.8, 0.0), vec3(2.5, 0.05, 2.5)*2., d);
        hit = hit0 > 0.0 ? 1.0 : 0.0;
        dist = d.x;
        norm = n0;
        mtl.albedo = vec3(1.0, 0.005, 0.005) * 0.8;
    }
    {
        vec2 d;
        float hit0 = RaySphereIntersect(ro, rd, vec3(0), 0.5, d);
        if ((hit0 > 0.0) && ((hit <= 0.0) || (dist > d.x)))
        {
            dist = d.x;
            norm = normalize(ro + rd * dist);
            mtl.albedo = vec3(1.0);
            hit = hit0;
        }
    }
    return hit;
}


vec3 renderScene(in vec3 ro, in vec3 rd)
{
    vec3 pot = vec3(1.0);
    vec3 col = vec3(0);
    for (float b = 0.0; b < float(GI_BOUNDS); ++b)
    {
        float dist;
        vec3 norm;
        Material mtl;
        if (sceneIntersect(ro, rd, dist, norm, mtl) > 0.0)
        {
            pot *= mtl.albedo;
            col = mtl.albedo;
            break;
        }
        else
        {
            col += pot * (textureLod(iChannel2, rd, 0.0).rgb);
            break;
        }
    }
    return col;
}




void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    const ivec2 dataAddr = ivec2(4,0);
    ivec2 iFragCoord = ivec2(fragCoord);

    vec3 pos, angles;
    vec4 mousePrev;
    if (iFrame > 0)
    {
        pos = texelFetch(iChannel0, dataAddr + ivec2(0,0), 0).xyz;
        angles = texelFetch(iChannel0, dataAddr + ivec2(1,0), 0).xyz;
        mousePrev = texelFetch(iChannel0, dataAddr + ivec2(2,0), 0);
    }
    else
    {
        pos = vec3(0.0, 0.0, -3.0);
        angles = vec3(0.0, 0.0, 0.0);
        mousePrev = iMouse;
    }

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

    vec3 col = renderScene(rayOrigin, rayDir);

    //vec3 col = vec3(1);
    fragColor = vec4(col, 0.0);

    {
        {
            const float moveSpeed = 5.0;
            vec3 move = vec3(0.0);
            if (keyIsPressed(iChannel1, KEY_W ))
            {
                move.z += moveSpeed;
            }
            if (keyIsPressed(iChannel1, KEY_S ))
            {
                move.z -= moveSpeed;
            }
            if (keyIsPressed(iChannel1, KEY_A ))
            {
                move.x -= moveSpeed;
            }
            if (keyIsPressed(iChannel1, KEY_D ))
            {
                move.x += moveSpeed;
            }
            move *= iTimeDelta;
            pos += right * move.x + front * move.z;
        }
        
        {
            const float rotateSpeed = 3.0;
            vec3 rotate = vec3(0);
            
            bool mouseDown = iMouse.z > 0.0;
            bool mouseWasDown = mousePrev.z > 0.0;
            if (mouseDown && mouseWasDown)
            {
                vec2 r = ((iMouse.xy - mousePrev.xy) / iResolution.xy) * rotateSpeed;
                r.y = -r.y;
                rotate.yx += r;
            }
            angles += rotate;
            angles.x = clamp(angles.x, -PI * .5, PI * .5);
        }

        vec4Store(dataAddr + ivec2(0,0), vec4(pos, 0), fragColor, iFragCoord);
        vec4Store(dataAddr + ivec2(1,0), vec4(angles, 0), fragColor, iFragCoord);
        vec4Store(dataAddr + ivec2(2,0), vec4(iMouse), fragColor, iFragCoord);
    }
}




































