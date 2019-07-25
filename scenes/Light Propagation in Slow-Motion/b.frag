bool isPressed(float key)
{
    return texture(iChannel0, vec2(key, 0.5/3.0)).x > 0.0;
}

bool isToggled(float key)
{
    return texture(iChannel0, vec2(key, 2.5/3.0)).x > 0.0;
}

bool isPressedThisFrame(float key)
{
    return texture(iChannel0, vec2(key, 1.5/3.0)).x > 0.0;
}

vec3 getPos()
{
    return texture(iChannel1, vec2(0.5, 0.5) / iResolution.xy).xyz;
}

vec3 getDir()
{
    return texture(iChannel1, vec2(1.5, 0.5) / iResolution.xy).xyz;
}

vec4 getTime()
{
    return texture(iChannel1, vec2(3.5, 0.5) / iResolution.xy);
}

const float KEY_LEFT  = 37.5/256.0;
const float KEY_UP    = 38.5/256.0;
const float KEY_RIGHT = 39.5/256.0;
const float KEY_DOWN  = 40.5/256.0;

const float KEY_W = 87.5/256.0;
const float KEY_A = 65.5/256.0;
const float KEY_S = 83.5/256.0;
const float KEY_D = 68.5/256.0;

const float KEY_SPACE = 32.5/256.0;
const float KEY_SHIFT = 16.5/256.0;
const float KEY_C     = 67.5/256.0;
const float KEY_CTRL  = 17.5/256.0;

const float KEY_Q = 81.5/256.0;
const float KEY_E = 69.5/256.0;

const float KEY_R = 82.5/256.0;
const float KEY_F = 70.5/256.0;

const float KEY_G = 71.5/256.0;

const float KEY_H = 72.5/256.0;
const float KEY_T = 84.5/256.0;

vec3 updatePos(in vec3 prevPos, in vec3 dir)
{
    if (iFrame == 0)
        return vec3(0.0);
    
    vec3 upDir = vec3(0.0, 1.0, 0.0);
    vec3 rightDir = normalize(cross(upDir, dir));
    
    vec3 pos = prevPos;
    
    if (isPressed(KEY_UP) || isPressed(KEY_W))
        pos += dir * iTimeDelta;
    
    if (isPressed(KEY_DOWN) || isPressed(KEY_S))
        pos -= dir * iTimeDelta;
    
    if (isPressed(KEY_RIGHT) || isPressed(KEY_D))
        pos += rightDir * iTimeDelta;
    
    if (isPressed(KEY_LEFT) || isPressed(KEY_A))
        pos -= rightDir * iTimeDelta;
    
    // Move up
    if (isPressed(KEY_SPACE) || isPressed(KEY_SHIFT))
        pos += upDir * iTimeDelta;
    
    // Move down
    if (isPressed(KEY_C) || isPressed(KEY_CTRL))
        pos -= upDir * iTimeDelta;
    
    return pos;
}

// From http://www.neilmendoza.com/glsl-rotation-about-an-arbitrary-axis/
mat4 rotationMatrix(vec3 axis, float angle)
{
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 updateDir(in vec3 prevDir)
{
    if (iFrame == 0)
        return normalize(vec3(0.0, -0.1, 1.0));
    
    vec3 dir = prevDir;
    
    vec3 side = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
    if (isPressed(KEY_R))
        dir = (rotationMatrix(side, -iTimeDelta) * vec4(dir, 1.0)).xyz;
        
    if (isPressed(KEY_F))
        dir = (rotationMatrix(side, iTimeDelta) * vec4(dir, 1.0)).xyz;
    
    if (isPressed(KEY_Q))
        dir = (rotationMatrix(vec3(0.0, 1.0, 0.0), iTimeDelta) * vec4(dir, 1.0)).xyz;
        
    if (isPressed(KEY_E))
        dir = (rotationMatrix(vec3(0.0, 1.0, 0.0), -iTimeDelta) * vec4(dir, 1.0)).xyz;
    
    return dir;
}

bool isAnythingPressed()
{
    return 
        isPressed(KEY_UP) || isPressed(KEY_DOWN) || isPressed(KEY_RIGHT) || isPressed(KEY_LEFT)
     || isPressed(KEY_W) || isPressed(KEY_A) || isPressed(KEY_S) || isPressed(KEY_D)
     || isPressed(KEY_SPACE) || isPressed(KEY_C) || isPressed(KEY_SHIFT) || isPressed(KEY_CTRL)
     || isPressed(KEY_Q) || isPressed(KEY_E) || isPressed(KEY_R) || isPressed(KEY_F) || isPressed(KEY_G);
}

vec4 updatePressed()
{
    vec4 result = vec4(0.0, 0.0, 0.0, 0.0);
    if (isAnythingPressed())
        result.x = 1.0;
    
    if (isToggled(KEY_T))
        result.y = 1.0;
    
    if (isToggled(KEY_H))
        result.z = 1.0;
    
    return result;
}

vec4 updateTime(in vec4 time)
{
    if (iFrame == 0)
        time = vec4(6.0, 0.0, 0.0, 0.0);
    
    if (isPressed(KEY_G))
        time.x += iTimeDelta;
    
    return time;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 prevPos = getPos();
    vec3 prevDir = getDir();
    
    // Position
    if (fragCoord.x < 1.0)
    {
        fragColor = vec4(updatePos(prevPos, prevDir), 1.0);
    }
    // Direction
    else if (fragCoord.x < 2.0)
    {
        fragColor = vec4(updateDir(prevDir), 1.0);
    }
    // Is anything pressed?
    else if (fragCoord.x < 3.0)
    {
        fragColor = updatePressed();
    }
    // Time
    else if (fragCoord.x < 4.0)
    {
        fragColor = updateTime(getTime());
    }
}


