// Controls
#define KEY_W 87
#define KEY_A 65
#define KEY_S 83
#define KEY_D 68

#define KEY_UP 38
#define KEY_DOWN 40
#define KEY_LEFT 37
#define KEY_RIGHT 39

#define KEY_SPACEBAR 32

#define KB_SENSITIVITY 0.1
#define MOUSE_SENSITIVITY 2.0

bool IsKeyPressed(int c)
{
    return texelFetch(iChannel0, ivec2(c, 0), 0).r > 0.0;
}

float GetKey(int c)
{
    return IsKeyPressed(c) ? KB_SENSITIVITY : 0.0;
}

Camera InitializeCamera()
{
    Camera cam;
    cam.position = vec3(0.4, -.75, 10.0);
    cam.direction = vec3(0.0, 0.0, -1.0);    
    return cam;
}

void MoveCamera(inout Camera cam)
{
    cam.position += cam.direction * (GetKey(KEY_W) + GetKey(KEY_UP));
    cam.position -= cam.direction * (GetKey(KEY_S) + GetKey(KEY_DOWN));
    
    vec3 right = cross(cam.direction, vec3(0.0, 1.0, 0.0));    
    cam.position += right * (GetKey(KEY_A) + GetKey(KEY_LEFT));
    cam.position -= right * (GetKey(KEY_D) + GetKey(KEY_RIGHT));
}

// iq / rodriguez
// (yeah it's not the optimized version, this is camera logic)
mat3x3 rotationAxisAngle( vec3 v, float a )
{
    float si = sin( a );
    float co = cos( a );
    float ic = 1.0f - co;

    return mat3x3( v.x*v.x*ic + co,       v.y*v.x*ic - si*v.z,    v.z*v.x*ic + si*v.y,
                   v.x*v.y*ic + si*v.z,   v.y*v.y*ic + co,        v.z*v.y*ic - si*v.x,
                   v.x*v.z*ic - si*v.y,   v.y*v.z*ic + si*v.x,    v.z*v.z*ic + co );
}

vec4 HandleMouse(out vec2 mouseDelta)
{
    vec4 prevMouse = texelFetch(iChannel1, ivec2(0, 2), 0);
    vec4 mouse = iMouse;
    mouseDelta = vec2(0.0);
    
    if(iMouse.z > 0.0)
    {
        if(prevMouse.z > 0.0)
            mouseDelta = mouse.xy - prevMouse.xy;
        
        return mouse;
    }
    
    return vec4(0.0);
}


void RotateCamera(inout Camera cam, vec2 mouseDelta)
{
    vec2 mouse = -mouseDelta.xy * MOUSE_SENSITIVITY / iResolution.xy;
    
    // Add more sensitivity over edges coz the screen is small D:
    float distanceToEdges = length((iMouse.xy / iResolution.xy) * 2.0 - 1.0);
    mouse *= 1.0 + distanceToEdges;
    
    vec3 right = cross(cam.direction, vec3(0.0, 1.0, 0.0));
    cam.direction = rotationAxisAngle(vec3(0.0, 1.0, 0.0), mouse.x) * cam.direction;
    cam.direction = rotationAxisAngle(right, mouse.y) * cam.direction;
}

void mainImage( out vec4 outColor, in vec2 fragCoord )
{    
    ivec2 coord = ivec2(fragCoord);
    outColor = vec4(0.0,0.0,0.0,1.0);
    Camera cam = LoadCamera(iChannel1);
    
    if(iFrame == 0 || IsKeyPressed(KEY_SPACEBAR))
        cam = InitializeCamera();
    
    vec2 mouseDelta;
    vec4 mouse = HandleMouse(mouseDelta);
    MoveCamera(cam);
    RotateCamera(cam, mouseDelta);
    
    if(coord.y == 0)
        outColor = vec4(cam.position, 0.0);
    else if(coord.y == 1)
        outColor = vec4(cam.direction, 0.0);
    else if(coord.y == 2)
        outColor = mouse;
}

