
#define GI_BOUNDS 6




vec3 renderScene(in vec3 ro, in vec3 rd)
{
    vec3 col = vec3(0);
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
    cam.fov = radians(25.0);

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
            const float rotateSpeed = 5.0;
            vec3 rotate = vec3(0);
            
            bool mouseDown = iMouse.z > 0.0;
            bool mouseWasDown = mousePrev.z > 0.0;
            if (mouseDown && mouseWasDown)
            {
                vec2 r = ((iMouse.xy - mousePrev.xy) / iResolution.xy) * rotateSpeed;
                rotate.yx += r;
            }
            angles += rotate;
            angles.x = clamp(angles.x, -PI * .5, PI * .5);
        }

        storeVec4(dataAddr + ivec2(0,0), vec4(pos, 0), fragColor, iFragCoord);
        storeVec4(dataAddr + ivec2(1,0), vec4(angles, 0), fragColor, iFragCoord);
        storeVec4(dataAddr + ivec2(2,0), vec4(iMouse), fragColor, iFragCoord);
    }
}




































