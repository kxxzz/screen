

const float PI = 3.14159265359;
const float InvPI = 1.0 / PI;
const float HalfPI = PI * 0.5;



struct Camera
{
    vec3 right, up, front;
    float fov;  
};



void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec3 angles = vec3(.4, .35, 0);
    vec3 right, up, front;
    anglesToAxes(angles, right, up, front);

    Camera cam;
    cam.right = right;
    cam.up = up;
    cam.front = front;
    cam.fov = HalfPI;

    float aspect = iResolution.x / iResolution.y;


    vec3 col = vec3(1);
    fragColor = vec4(col, 0.0);
}




































